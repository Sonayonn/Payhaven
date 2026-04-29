import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { env } from "@/lib/env";
import { verifyPrivyTokenAndGetIdentifiers } from "@/lib/privy/server";
import { getSupabase } from "@/lib/supabase/server";
import { redactIdentifier } from "@/lib/format/identifiers";

/**
 * GET /api/send-history
 *
 * Returns the authenticated user's recent sends, ordered newest first,
 * limited to 20. Per Step 8 spec, this is the persistence layer that lets
 * SendHistory survive a refresh.
 *
 * Response shape per row:
 *   {
 *     token: string,                    // claim_tokens.token, used as React key + in claim URL
 *     redactedRecipient: string,        // server-redacted, never exposes raw identifier
 *     amountUsdcBaseUnits: string,      // string-encoded bigint, frontend divides by 1e6
 *     status: "pending" | "claimed" | "expired",
 *     createdAt: string,                // ISO timestamp
 *     claimedAt: string | null,         // ISO timestamp when status === "claimed"
 *     createUtxoSignature: string,      // for Solscan link on the send leg
 *     claimedTxSignature: string | null,// for Solscan link on the claim leg (if claimed)
 *     claimUrl: string,                 // ready-to-reshare deep link
 *   }
 *
 * Privacy notes:
 *   - We never return the recipient's wallet address or walletId. Sender
 *     side has no business knowing where the UTXO landed; that's the recipient's.
 *   - Identifier is redacted server-side. The raw form lives only in claim_tokens.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return apiError("UNAUTHORIZED", "Missing Authorization header");
  }

  let identity;
  try {
    identity = await verifyPrivyTokenAndGetIdentifiers(token);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("claim_tokens")
    .select(
      "token, recipient_identifier, amount_usdc_base_units, status, created_at, claimed_at, create_utxo_signature, claimed_tx_signature",
    )
    .eq("sender_privy_user_id", identity.privyUserId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    log.error("Failed to fetch send history", { err: error.message });
    return apiError("UPSTREAM_ERROR", "Failed to load send history");
  }

  const appBaseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const rows = (data ?? []).map((r) => ({
    token: r.token as string,
    redactedRecipient: redactIdentifier(r.recipient_identifier as string),
    amountUsdcBaseUnits: String(r.amount_usdc_base_units),
    status: r.status as "pending" | "claimed" | "expired",
    createdAt: r.created_at as string,
    claimedAt: r.claimed_at as string | null,
    createUtxoSignature: r.create_utxo_signature as string,
    claimedTxSignature: r.claimed_tx_signature as string | null,
    claimUrl: `${appBaseUrl}/claim/${r.token as string}`,
  }));

  return Response.json({ ok: true, rows });
}