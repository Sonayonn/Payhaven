import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import {
  findClaimTokenByToken,
  markClaimTokenClaimed,
} from "@/lib/claim-tokens/server";
import { verifyPrivyTokenAndGetIdentifiers } from "@/lib/privy/server";
import { normalizeIdentifier } from "@/lib/privy/pregen";
import {
  claimReceiverUtxo,
  ClaimNotSubmittedError,
} from "@/lib/umbra/claim-utxo";

/**
 * POST /api/claim/[token] — claim ONE receiver-claimable UTXO.
 *
 * The recipient may have multiple unclaimed UTXOs (across multiple sends).
 * Each call to this endpoint claims a single UTXO (FIFO, oldest first) and
 * returns `remainingUtxoCount`. The frontend is expected to loop until that
 * count is 0.
 *
 * Why one UTXO per call: each claim generates a ZK proof that spikes RAM by
 * ~500MB-1GB. Vercel function memory caps would be blown by batched claims.
 * Looping client-side, each call gets a fresh memory allocation.
 *
 * The DB row is marked claimed on the FIRST successful claim. Subsequent
 * calls (draining the queue) update claimed_tx_signature with the latest
 * signature but do not error on the already-claimed status.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || token.length < 20) {
    return apiError("BAD_REQUEST", "Invalid claim token");
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const authToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!authToken) {
    return apiError("UNAUTHORIZED", "Missing Authorization header");
  }

  let identifiers: {
    privyUserId: string;
    email: string | null;
    phone: string | null;
  };

  try {
    identifiers = await verifyPrivyTokenAndGetIdentifiers(authToken);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  // ── Look up claim token ─────────────────────────────────────────────────
  const record = await findClaimTokenByToken(token);
  if (!record) {
    return apiError("NOT_FOUND", "Claim link not found or invalid");
  }

  // ── Identity check ──────────────────────────────────────────────────────
  const userIdentifiers: string[] = [];
  if (identifiers.email) {
    userIdentifiers.push(normalizeIdentifier(identifiers.email, "email"));
  }
  if (identifiers.phone) {
    userIdentifiers.push(normalizeIdentifier(identifiers.phone, "phone"));
  }
  if (!userIdentifiers.includes(record.recipientIdentifier)) {
    log.warn("Identity mismatch on claim attempt", {
      privyUserId: identifiers.privyUserId,
      recipientIdentifier: record.recipientIdentifier,
    });
    return apiError(
      "UNAUTHORIZED",
      "This claim is addressed to a different recipient",
    );
  }

  // ── Submit one claim to Umbra ───────────────────────────────────────────
  //
  // We deliberately do NOT short-circuit on record.status === "claimed".
  // The DB row tracks first-claim state, but the recipient may have more
  // UTXOs queued on-chain (multiple sends to the same recipient before
  // claiming). We drain one UTXO per call; frontend loops until queue empty.
  let claimResult;
  try {
    claimResult = await claimReceiverUtxo({
      recipientWalletId: record.recipientWalletId,
      recipientAddress: record.recipientAddress,
      createUtxoSignature: record.createUtxoSignature,
    });
  } catch (err) {
    // Special handling: "no claimable UTXOs found" means the queue is empty.
    // This is a NORMAL terminal state when the frontend loop has drained
    // everything. Return ok with remainingUtxoCount=0 rather than an error.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("No claimable UTXOs found")) {
      return Response.json({
        ok: true,
        claimSignatures: [],
        remainingUtxoCount: 0,
        queueEmpty: true,
      });
    }

    if (err instanceof ClaimNotSubmittedError) {
      log.error("Claim returned no signatures", { token, message });
      return apiError(
        "UPSTREAM_ERROR",
        "The relayer did not submit the claim. This usually means the UTXO " +
          "was already claimed or the relayer is having issues. Please retry.",
        { logFields: { sdkResult: err.sdkResult } },
      );
    }

    const stage = (err as { stage?: string } | null)?.stage;
    const stack = err instanceof Error ? err.stack : undefined;
    log.error("Claim failed", { token, stage, message, stack });
    return apiError("UPSTREAM_ERROR", "Claim submission failed", {
      logFields: { stage, message },
    });
  }

  // ── Mark claimed in Supabase ────────────────────────────────────────────
  // Always update the signature column with the latest successful claim,
  // so the DB reflects the most recent on-chain signature even after
  // multiple drains. Status stays "claimed" once set.
  try {
    await markClaimTokenClaimed({
      token,
      claimedTxSignature: claimResult.claimSignatures[0] ?? "",
    });
  } catch (err) {
    // Non-fatal. The on-chain claim succeeded; our DB is just out of sync.
    log.error("Claim succeeded on-chain but DB update failed", {
      token,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return Response.json({
    ok: true,
    claimSignatures: claimResult.claimSignatures,
    remainingUtxoCount: claimResult.remainingUtxoCount,
    queueEmpty: claimResult.remainingUtxoCount === 0,
  });
}