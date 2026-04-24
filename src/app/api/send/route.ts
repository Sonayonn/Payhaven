import { NextRequest } from "next/server";
import { z } from "zod";
import { address } from "@solana/kit";
import { getPublicBalanceToReceiverClaimableUtxoCreatorFunction } from "@umbra-privacy/sdk";
import { getCreateReceiverClaimableUtxoFromPublicBalanceProver } from "@umbra-privacy/web-zk-prover";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { usdcToBaseUnits } from "@/lib/money";
import { USDC_MAINNET_MINT } from "@/lib/umbra/constants";
import { getPrivyUmbraClient } from "@/lib/umbra/privy-umbra-client";
import { registerWalletIfNeeded } from "@/lib/umbra/wallet-registration";
import { verifyPrivyToken } from "@/lib/privy/server";
import { ensureSenderWallet } from "@/lib/privy/sender-wallet";
import {
  pregenerateRecipientWallet,
  normalizeIdentifier,
  type PregenResult,
} from "@/lib/privy/pregen";
import { createClaimToken } from "@/lib/claim-tokens/server";
import type { U64 } from "@umbra-privacy/sdk/types";

// ── Request validation ─────────────────────────────────────────────────────

const sendRequestSchema = z.object({
  recipient: z.object({
    kind: z.enum(["email", "phone"]),
    value: z.string().min(3),
  }),
  amountUsdc: z.number().positive().finite(),
});

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Verify Privy access token ────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return apiError("UNAUTHORIZED", "Missing Authorization header");
  }

  let senderPrivyUserId: string;
  try {
    senderPrivyUserId = await verifyPrivyToken(token);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  // ── Parse + validate body ────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Request body must be valid JSON");
  }

  const parsed = sendRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "Invalid request body", {
      logFields: { issues: parsed.error.issues },
    });
  }

  const { recipient: rawRecipient, amountUsdc } = parsed.data;

  // Normalize the recipient identifier at the edge so dedup lookups,
  // logs, and claim_tokens.recipient_identifier persistence all share
  // one canonical form. Emails lowercase+trim, phones collapse to E.164.
  // Rejects non-E.164 phone input with a user-visible error.
  let recipient: { kind: "email" | "phone"; value: string };
  try {
    recipient = {
      kind: rawRecipient.kind,
      value: normalizeIdentifier(rawRecipient.value, rawRecipient.kind),
    };
  } catch (err) {
    return apiError("VALIDATION_FAILED", "Invalid recipient identifier", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }

  let amountBaseUnits: U64;
  try {
    amountBaseUnits = usdcToBaseUnits(amountUsdc) as unknown as U64;
  } catch (err) {
    return apiError("VALIDATION_FAILED", "Invalid USDC amount", {
      logFields: { amountUsdc, err: String(err) },
    });
  }

  log.info("Send request accepted", {
    senderPrivyUserId,
    recipientKind: recipient.kind,
    amountBaseUnits: amountBaseUnits.toString(),
  });

  // ── Resolve sender's Payhaven wallet ─────────────────────────────────────
  // Should already exist (created on first login via /api/sender-wallet).
  // ensureSenderWallet is idempotent: if already registered, it returns
  // immediately from Supabase with no Privy or on-chain calls.
  let senderWallet;
  try {
    senderWallet = await ensureSenderWallet(senderPrivyUserId);
  } catch (err) {
    return apiError("UPSTREAM_ERROR", "Failed to resolve sender wallet", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }

  log.info("Sender wallet resolved", {
    senderPrivyUserId,
    senderAddress: senderWallet.solanaAddress,
  });

  // ── Pregenerate (or reuse) recipient wallet ──────────────────────────────
  let pregen: PregenResult;
  try {
    pregen = await pregenerateRecipientWallet(recipient.value, recipient.kind);
  } catch (err) {
    return apiError("UPSTREAM_ERROR", "Failed to pregenerate recipient wallet", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }
  const recipientAddress = pregen.solanaAddress;
  const recipientWalletId = pregen.walletId;

  // ── Pre-register recipient with Umbra ────────────────────────────────────
  // Receiver-claimable UTXOs require an on-chain X25519 key for the
  // recipient. Skipped entirely on repeat sends (previouslyRegistered=true).
  if (!pregen.previouslyRegistered) {
    try {
      const { alreadyRegistered, signatures } = await registerWalletIfNeeded({
        walletId: recipientWalletId,
        address: recipientAddress,
      });
      log.info("Recipient registration checked", {
        recipientAddress,
        alreadyRegistered,
        registrationTxCount: signatures.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stage = (err as { stage?: string } | null)?.stage;
      return apiError(
        "UPSTREAM_ERROR",
        "Failed to register recipient with Umbra",
        { logFields: { message, stage, recipientAddress } },
      );
    }
  } else {
    log.info("Recipient previously registered — skipping registration", {
      recipientAddress,
    });
  }

  // ── Create UTXO via Umbra — signed by the SENDER's wallet ────────────────
  // This is the core privacy guarantee: USDC leaves the sender's ATA and
  // lands in the shielded pool, encrypted to the recipient. The on-chain
  // graph shows only "sender → Umbra program." No treasury intermediary.
  let createUtxoSignature: string;
  try {
    const senderClient = await getPrivyUmbraClient({
      walletId: senderWallet.walletId,
      address: senderWallet.solanaAddress,
    });
    const zkProver = getCreateReceiverClaimableUtxoFromPublicBalanceProver();
    const createUtxo = getPublicBalanceToReceiverClaimableUtxoCreatorFunction(
      { client: senderClient },
      { zkProver },
    );

    const result = await createUtxo({
      destinationAddress: address(recipientAddress),
      mint: USDC_MAINNET_MINT,
      amount: amountBaseUnits,
    });
    createUtxoSignature = result.createUtxoSignature;

    log.info("UTXO created by sender wallet", {
      createUtxoSignature,
      senderAddress: senderWallet.solanaAddress,
      recipientAddress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stage = (err as { stage?: string } | null)?.stage;
    return apiError("UPSTREAM_ERROR", "UTXO creation failed", {
      logFields: { message, stage },
    });
  }

  // ── Create claim token ───────────────────────────────────────────────────
  let claimToken;
  try {
    claimToken = await createClaimToken({
      recipientIdentifier: recipient.value,
      recipientAddress,
      recipientWalletId,
      amountUsdcBaseUnits: BigInt(amountBaseUnits.toString()),
      createUtxoSignature,
      senderPrivyUserId,
      umbraRegisteredAt: new Date(),
    });
  } catch (err) {
    log.error("Claim token creation failed — UTXO is orphaned", {
      err: err instanceof Error ? err.message : String(err),
      createUtxoSignature,
    });
    return apiError("INTERNAL_ERROR", "Claim token persistence failed");
  }

  return Response.json({
    ok: true,
    claimToken: claimToken.token,
    expiresAt: claimToken.expiresAt,
    createUtxoSignature,
  });
}