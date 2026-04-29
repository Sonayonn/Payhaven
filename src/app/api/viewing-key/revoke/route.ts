import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";
import { verifyPrivyTokenAndGetIdentifiers } from "@/lib/privy/server";
import { revokeAllGrantsForUser } from "@/lib/viewing-keys/server";

/**
 * POST /api/viewing-key/revoke
 *
 * Marks all viewing-key grants for the user as revoked in our database.
 *
 * IMPORTANT, what this does NOT do:
 *
 * Per https://sdk.umbraprivacy.com/sdk/compliance-viewing-keys, mixer-pool
 * viewing keys are off-chain credentials. Once derived and shared, they are
 * cryptographically valid forever for whoever holds them, there is no on-chain
 * registry to revoke against, and the master viewing key cannot retroactively
 * invalidate keys derived under it (past UTXO ciphertexts are encrypted under
 * the old MVK and remain decryptable with derived keys).
 *
 * "Revoke" in our UX is therefore a record-keeping action: it removes the
 * grant from the user's list and signals our intent that the recipient
 * shouldn't use it anymore. The cryptographic key itself is not invalidated.
 *
 * The UI surfaces this honestly via the confirmation dialog. For institutional
 * use cases that need real on-chain revocation, see X25519 Compliance Grants
 * (https://sdk.umbraprivacy.com/sdk/compliance-x25519-grants), that primitive
 * is on Payhaven's roadmap.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return apiError("UNAUTHORIZED", "Missing Authorization header");

  let identity;
  try {
    identity = await verifyPrivyTokenAndGetIdentifiers(token);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  try {
    const revokedCount = await revokeAllGrantsForUser(identity.privyUserId);
    return Response.json({ ok: true, revokedCount });
  } catch (err) {
    return apiError("UPSTREAM_ERROR", "Failed to revoke grants", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }
}