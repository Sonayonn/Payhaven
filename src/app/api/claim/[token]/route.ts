import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import {
  findClaimTokenByToken,
  markClaimTokenClaimed,
} from "@/lib/claim-tokens/server";
import { verifyPrivyTokenAndGetIdentifiers } from "@/lib/privy/server";
import { normalizeIdentifier } from "@/lib/privy/pregen";
import { claimReceiverUtxo } from "@/lib/umbra/claim-utxo";

/**
 * POST /api/claim/[token], claim the receiver-claimable UTXO.
 *
 * Recipient must be authenticated via Privy AND their email/phone must match
 * the claim_token's recipient_identifier. Server-side signs the claim using
 * the pregenerated Payhaven wallet for that identifier. Gasless for the
 * recipient (Umbra relayer pays tx fees).
 *
 * Idempotency: if claim_tokens.status is already 'claimed', returns the
 * existing claim_tx_signature without re-submitting to the relayer.
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

  // ── Already claimed? Idempotent short-circuit ───────────────────────────
  if (record.status === "claimed") {
    return Response.json({
      ok: true,
      alreadyClaimed: true,
      claimSignatures: [record.createUtxoSignature], // best-effort; real sig is in claimed_tx_signature field but we didn't select it
      message: "This claim has already been completed",
    });
  }

  // ── Need recipient_wallet_id to build the Umbra client ──────────────────
  // findClaimTokenByToken doesn't currently return recipient_wallet_id publicly
  // (it's an internal detail). Re-query with full select, or extend the helper.
  // For simplicity, we extend findClaimTokenByToken below, see #6.
  const recipientWalletId = (record as unknown as { recipientWalletId?: string })
    .recipientWalletId;
  const recipientAddress = (record as unknown as { recipientAddress?: string })
    .recipientAddress;

  if (!recipientWalletId || !recipientAddress) {
    log.error("Claim token missing recipient wallet details", { token });
    return apiError(
      "INTERNAL_ERROR",
      "Claim token record is incomplete, contact support",
    );
  }

  // ── Submit claim to Umbra ───────────────────────────────────────────────
  let claimResult;
  try {
    claimResult = await claimReceiverUtxo({
      recipientWalletId,
      recipientAddress,
      createUtxoSignature: record.createUtxoSignature,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stage = (err as { stage?: string } | null)?.stage;
    const stack = err instanceof Error ? err.stack : undefined;
    log.error("Claim failed", {
      token,
      stage,
      message,
      stack,
    });
    return apiError("UPSTREAM_ERROR", "Claim submission failed", {
      logFields: { stage, message },
    });
  }

  // ── Mark claimed in Supabase ────────────────────────────────────────────
  try {
    await markClaimTokenClaimed({
      token,
      claimedTxSignature: claimResult.claimSignatures[0] ?? "",
    });
  } catch (err) {
    // Non-fatal. The on-chain claim succeeded; our DB is just out of sync.
    log.error("Marked claim succeeded on-chain but DB update failed", {
      token,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return Response.json({
    ok: true,
    alreadyClaimed: false,
    claimSignatures: claimResult.claimSignatures,
  });
}