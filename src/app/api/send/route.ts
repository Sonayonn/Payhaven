/**
 * POST /api/send
 *
 * Sender-side UTXO creation endpoint. Given a recipient address and a USDC
 * amount, the treasury creates a receiver-claimable UTXO in Umbra's mixer pool.
 *
 * TODO(sprint-1): add Privy auth — anyone can call this right now.
 * TODO(sprint-2): generate + persist a claim token, return that instead of raw tx sigs.
 * TODO(sprint-2): trigger SMS notification to the recipient's phone.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { address } from "@solana/kit";
import { getPublicBalanceToReceiverClaimableUtxoCreatorFunction } from "@umbra-privacy/sdk";
import { getCreateReceiverClaimableUtxoFromPublicBalanceProver } from "@umbra-privacy/web-zk-prover";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { usdcToBaseUnits } from "@/lib/money";
import { USDC_MAINNET_MINT } from "@/lib/umbra/constants";
import { getTreasuryUmbraClient } from "@/lib/umbra/treasury";
import type { U64 } from "@umbra-privacy/sdk/types";

// ── Request validation ─────────────────────────────────────────────────────

const sendRequestSchema = z.object({
  recipientAddress: z
    .string()
    .min(32)
    .max(44)
    .refine((v) => {
      try {
        address(v);
        return true;
      } catch {
        return false;
      }
    }, "not a valid Solana address"),
  amountUsdc: z.number().positive().finite(),
});

// ── Handler ────────────────────────────────────────────────────────────────

import { verifyPrivyToken } from "@/lib/privy/server";

export async function POST(req: NextRequest) {
  // ── Verify Privy access token ────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return apiError("UNAUTHORIZED", "Missing Authorization header");
  }

  let privyUserId: string;
  try {
    privyUserId = await verifyPrivyToken(token);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  log.info("Authenticated send request", { privyUserId });

  // Parse body. Reject anything that isn't valid JSON.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Request body must be valid JSON");
  }

  // Validate shape with zod — this is the trust boundary.
  const parsed = sendRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "Invalid request body", {
      logFields: { issues: parsed.error.issues },
    });
  }

  const { recipientAddress, amountUsdc } = parsed.data;

  // Convert to base units once, at the edge. After this line we use U64.
  let amountBaseUnits: U64;
  try {
    amountBaseUnits = usdcToBaseUnits(amountUsdc) as unknown as U64;
  } catch (err) {
    return apiError("VALIDATION_FAILED", "Invalid USDC amount", {
      logFields: { amountUsdc, err: String(err) },
    });
  }

  log.info("Send request accepted", {
    recipientAddress,
    amountUsdc,
    amountBaseUnits: amountBaseUnits.toString(),
  });

  // ── Call Umbra SDK ───────────────────────────────────────────────────────
  // Primitive: getPublicBalanceToReceiverClaimableUtxoCreatorFunction
  // Why: the treasury holds USDC in its public ATA. We deposit it into the
  // mixer with the recipient as the only party who can claim.
  // Doc ref: CONVENTIONS.md §3 (primitive cheat sheet).
  try {
    const client = await getTreasuryUmbraClient();
    const zkProver = getCreateReceiverClaimableUtxoFromPublicBalanceProver();
    const createUtxo = getPublicBalanceToReceiverClaimableUtxoCreatorFunction(
      { client },
      { zkProver },
    );

    const result = await createUtxo({
      destinationAddress: address(recipientAddress),
      mint: USDC_MAINNET_MINT,
      amount: amountBaseUnits,
    });

    log.info("UTXO created", {
      createUtxoSignature: result.createUtxoSignature,
    });

    // TODO(sprint-2): generate a claim token, persist the mapping, send SMS.
    return Response.json({
      ok: true,
      createProofAccountSignature: result.createProofAccountSignature,
      createUtxoSignature: result.createUtxoSignature,
      closeProofAccountSignature: result.closeProofAccountSignature ?? null,
    });
  } catch (err) {
    // Umbra SDK throws typed errors with a `stage` field. See CONVENTIONS.md
    // §9 — certain error stages may indicate unstable network, in which case
    // we bubble up a clearer message for retries.
    const message = err instanceof Error ? err.message : String(err);
    const stage = (err as { stage?: string } | null)?.stage;
    return apiError("UPSTREAM_ERROR", "UTXO creation failed", {
      logFields: { message, stage },
    });
  }
}