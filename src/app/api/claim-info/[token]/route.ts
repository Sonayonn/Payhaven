import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";
import { findClaimTokenByToken } from "@/lib/claim-tokens/server";
import { verifyPrivyTokenAndGetIdentifiers } from "@/lib/privy/server";
import { normalizeIdentifier } from "@/lib/privy/pregen";
import { log } from "@/lib/log";

export async function GET(
  req: NextRequest,
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

  // ── Identity check: is the requester the intended recipient? ────────────
  // If no auth header, we don't try to verify — the client will show the
  // "sign in to claim" state. Only when the user presents a token do we
  // compare against recipient_identifier.
  let isAuthorizedRecipient = false;
  const authHeader = req.headers.get("authorization");
  const authToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (authToken) {
    try {
      const { email, phone } = await verifyPrivyTokenAndGetIdentifiers(authToken);
      const recipientNorm = record.recipientIdentifier; // stored normalized
      const userIdentifiers: string[] = [];
      if (email) userIdentifiers.push(normalizeIdentifier(email, "email"));
      if (phone) userIdentifiers.push(normalizeIdentifier(phone, "phone"));
      isAuthorizedRecipient = userIdentifiers.includes(recipientNorm);
    } catch (err) {
      // Bad/expired token — treat as unauthenticated; don't error the whole
      // response, just leave isAuthorizedRecipient false.
      log.warn("Identity check failed on claim-info", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
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
    isAuthorizedRecipient,
  });
}