import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";
import { findClaimTokenByToken } from "@/lib/claim-tokens/server";
import { log } from "@/lib/log";

/**
 * Public claim info endpoint — no auth required.
 *
 * Returns the minimum data needed to render the /claim/[token] page before
 * login: how much, what status, when it was created. Does NOT return the
 * sender's Privy ID, the recipient's Umbra address, or the UTXO signature
 * (those come into play after recipient authenticates and initiates claim).
 *
 * Rate-limiting is a production concern; we don't do it for the hackathon
 * since the only way to hit this endpoint usefully is with a 43-char random
 * token, which is itself the rate limit.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || token.length < 20) {
    return apiError("BAD_REQUEST", "Invalid claim token");
  }

  let record;
  try {
    record = await findClaimTokenByToken(token);
  } catch (err) {
    log.error("Claim info lookup failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return apiError("INTERNAL_ERROR", "Could not look up claim");
  }

  if (!record) {
    return apiError("NOT_FOUND", "Claim link not found or invalid");
  }

  const now = new Date();
  const expiresAt = new Date(record.expiresAt);
  const isExpired = now > expiresAt;

  return Response.json({
    ok: true,
    amountUsdcBaseUnits: record.amountUsdcBaseUnits,
    recipientIdentifier: record.recipientIdentifier,
    status: record.status,
    isExpired,
    expiresAt: record.expiresAt,
    claimedAt: record.claimedAt,
  });
}