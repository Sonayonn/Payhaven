import "server-only";
import { getSupabase } from "@/lib/supabase/server";

// Same Supabase typegen workaround as viewing-keys/server.ts, typegen
// doesn't know about the new table yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return getSupabase();
}

export type InviteValidation =
  | { ok: true; code: string; firstUse: boolean }
  | { ok: false; reason: "INVALID" | "ALREADY_CLAIMED_BY_OTHER" };

/**
 * Validate an invite code for a given Privy user.
 */
export async function validateAndClaimInvite(
  code: string,
  privyUserId: string,
): Promise<InviteValidation> {
  const normalized = code.trim().toUpperCase();

  // Fetch first to know the code exists.
  const { data: existing, error: lookupErr } = await db()
    .from("invite_codes")
    .select("code, claimed_by_privy_user_id")
    .eq("code", normalized)
    .maybeSingle();

  if (lookupErr) {
    throw new Error("Invite lookup failed: " + lookupErr.message);
  }
  if (!existing) {
    return { ok: false, reason: "INVALID" };
  }

  if (existing.claimed_by_privy_user_id) {
    if (existing.claimed_by_privy_user_id === privyUserId) {
      return { ok: true, code: normalized, firstUse: false };
    }
    return { ok: false, reason: "ALREADY_CLAIMED_BY_OTHER" };
  }

  // Atomic claim. The `is null` guard prevents two-sender races.
  const { data: claimed, error: claimErr } = await db()
    .from("invite_codes")
    .update({
      claimed_by_privy_user_id: privyUserId,
      claimed_at: new Date().toISOString(),
    })
    .eq("code", normalized)
    .is("claimed_by_privy_user_id", null)
    .select("code")
    .maybeSingle();

  if (claimErr) {
    throw new Error("Invite claim failed: " + claimErr.message);
  }
  if (!claimed) {
    // Lost the race, someone else claimed it microseconds ago.
    return { ok: false, reason: "ALREADY_CLAIMED_BY_OTHER" };
  }

  return { ok: true, code: normalized, firstUse: true };
}

export async function checkCodeExists(code: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  const { data, error } = await db()
    .from("invite_codes")
    .select("code")
    .eq("code", normalized)
    .maybeSingle();

  if (error) {
    throw new Error("Invite lookup failed: " + error.message);
  }
  return Boolean(data);
}