import "server-only";
import { randomBytes } from "crypto";
import { getSupabase } from "@/lib/supabase/server";

/**
 * Generate a URL-safe random claim token.
 * 32 bytes → 43 characters of base64url. Unguessable.
 */
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export type ClaimTokenInput = {
  recipientIdentifier: string; // phone or email
  recipientAddress: string; // pregenerated Solana address
  recipientWalletId: string; // Privy walletId, needed at claim time for server-side signing
  amountUsdcBaseUnits: bigint;
  createUtxoSignature: string;
  senderPrivyUserId: string;
  umbraRegisteredAt?: Date; // defaults to now() if registration just completed
  ttlHours?: number; // defaults to 72
};

export type ClaimTokenRecord = {
  id: string;
  token: string;
  expiresAt: string;
};

export async function createClaimToken(
  input: ClaimTokenInput,
): Promise<ClaimTokenRecord> {
  const supabase = getSupabase();
  const token = generateToken();
  const ttlHours = input.ttlHours ?? 72;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const umbraRegisteredAt = (input.umbraRegisteredAt ?? new Date()).toISOString();

  const { data, error } = await supabase
    .from("claim_tokens")
    .insert({
      token,
      recipient_identifier: input.recipientIdentifier,
      recipient_address: input.recipientAddress,
      recipient_wallet_id: input.recipientWalletId,
      amount_usdc_base_units: Number(input.amountUsdcBaseUnits),
      create_utxo_signature: input.createUtxoSignature,
      sender_privy_user_id: input.senderPrivyUserId,
      status: "pending",
      expires_at: expiresAt,
      umbra_registered_at: umbraRegisteredAt,
    })
    .select("id, token, expires_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create claim token: ${error?.message ?? "no data returned"}`,
    );
  }

  return {
    id: data.id as string,
    token: data.token as string,
    expiresAt: data.expires_at as string,
  };
}

/**
 * Look up an existing recipient wallet by phone/email identifier.
 *
 * If any prior send exists to the same identifier, we reuse that wallet
 * instead of asking Privy to create a new one. This preserves the "same
 * email → same wallet" semantic that Payhaven users will expect, avoids
 * leaking SOL on redundant registrations, and keeps repeat-recipient
 * sends fast (the already-registered wallet skips the registration step).
 *
 * Returns null if this identifier has never been sent to before.
 */
export async function findExistingRecipientWallet(
  recipientIdentifier: string,
): Promise<{
  walletId: string;
  address: string;
  umbraRegisteredAt: string | null;
} | null> {
  const supabase = getSupabase();

  // Match the identifier exactly. Normalization (lowercase emails,
  // E.164 phones) happens upstream in pregen.ts before this is called,
  // so both write and read paths converge on the same canonical form.
  const { data, error } = await supabase
    .from("claim_tokens")
    .select("recipient_wallet_id, recipient_address, umbra_registered_at")
    .eq("recipient_identifier", recipientIdentifier)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to look up recipient wallet: ${error.message}`,
    );
  }

  if (!data) return null;

  return {
    walletId: data.recipient_wallet_id as string,
    address: data.recipient_address as string,
    umbraRegisteredAt: data.umbra_registered_at as string | null,
  };
}

/**
 * Look up a claim token by its URL-safe token string.
 *
 * Returns:
 *  - Public-safe fields used by /api/claim-info (amount, status, expiry, etc.)
 *  - Backend-only fields used by /api/claim (recipientAddress, recipientWalletId)
 *
 * The route layer is responsible for not leaking the backend-only fields
 * to unauthenticated requests, see /api/claim-info/[token]/route.ts which
 * deliberately does not include them in its Response.json.
 *
 * Returns null when the token doesn't exist.
 */
export async function findClaimTokenByToken(
  token: string,
): Promise<{
  token: string;
  recipientIdentifier: string;
  recipientAddress: string;
  recipientWalletId: string;
  amountUsdcBaseUnits: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  claimedAt: string | null;
  createUtxoSignature: string;
} | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("claim_tokens")
    .select(
      "token, recipient_identifier, recipient_address, recipient_wallet_id, amount_usdc_base_units, status, created_at, expires_at, claimed_at, create_utxo_signature",
    )
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find claim token: ${error.message}`);
  }
  if (!data) return null;

  return {
    token: data.token as string,
    recipientIdentifier: data.recipient_identifier as string,
    recipientAddress: data.recipient_address as string,
    recipientWalletId: data.recipient_wallet_id as string,
    // amount_usdc_base_units is stored as bigint in Postgres; Supabase
    // returns it as number for small values. Keep as string in the API
    // response so we never lose precision on large amounts.
    amountUsdcBaseUnits: String(data.amount_usdc_base_units),
    status: data.status as string,
    createdAt: data.created_at as string,
    expiresAt: data.expires_at as string,
    claimedAt: data.claimed_at as string | null,
    createUtxoSignature: data.create_utxo_signature as string,
  };
}
/**
 * Mark a claim token as successfully claimed. Idempotent, if already claimed,
 * does not error (returns the existing claimed_tx_signature instead).
 *
 * Called after /api/claim successfully submits to the relayer. The on-chain
 * nullifier is the source of truth; this DB update is for our own UX
 * (showing "claimed" in the recipient's history and preventing duplicate
 * UI operations).
 */
export async function markClaimTokenClaimed(params: {
  token: string;
  claimedTxSignature: string;
}): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("claim_tokens")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_tx_signature: params.claimedTxSignature,
    })
    .eq("token", params.token);

  if (error) {
    throw new Error(`Failed to mark claim token claimed: ${error.message}`);
  }
}