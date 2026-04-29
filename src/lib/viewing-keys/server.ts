import "server-only";
import { getSupabase } from "@/lib/supabase/server";

export type ViewingKeyGrant = {
  id: string;
  privyUserId: string;
  mintAddress: string;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  label: string | null;
  generatedAt: string;
  revokedAt: string | null;
};

type DbRow = {
  id: string;
  privy_user_id: string;
  mint_address: string;
  grant_year_start: number;
  grant_month_start: number;
  grant_year_end: number;
  grant_month_end: number;
  label: string | null;
  generated_at: string;
  revoked_at: string | null;
};

function rowToGrant(row: DbRow): ViewingKeyGrant {
  return {
    id: row.id,
    privyUserId: row.privy_user_id,
    mintAddress: row.mint_address,
    startYear: row.grant_year_start,
    startMonth: row.grant_month_start,
    endYear: row.grant_year_end,
    endMonth: row.grant_month_end,
    label: row.label,
    generatedAt: row.generated_at,
    revokedAt: row.revoked_at,
  };
}


function db(): any {
  return getSupabase();
}

export async function insertViewingKeyGrant(input: {
  privyUserId: string;
  mintAddress: string;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  label: string | null;
}): Promise<ViewingKeyGrant> {
  const { data, error } = await db()
    .from("viewing_key_grants")
    .insert({
      privy_user_id: input.privyUserId,
      mint_address: input.mintAddress,
      grant_year_start: input.startYear,
      grant_month_start: input.startMonth,
      grant_year_end: input.endYear,
      grant_month_end: input.endMonth,
      label: input.label,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      "Failed to insert viewing_key_grant: " + (error?.message ?? "no data"),
    );
  }
  return rowToGrant(data as DbRow);
}

export async function listActiveGrants(
  privyUserId: string,
): Promise<ViewingKeyGrant[]> {
  const { data, error } = await db()
    .from("viewing_key_grants")
    .select("*")
    .eq("privy_user_id", privyUserId)
    .is("revoked_at", null)
    .order("generated_at", { ascending: false });

  if (error) {
    throw new Error("Failed to list viewing_key_grants: " + error.message);
  }
  return ((data ?? []) as DbRow[]).map(rowToGrant);
}

export async function revokeAllGrantsForUser(
  privyUserId: string,
): Promise<number> {
  const { data, error } = await db()
    .from("viewing_key_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("privy_user_id", privyUserId)
    .is("revoked_at", null)
    .select("id");

  if (error) {
    throw new Error("Failed to revoke grants: " + error.message);
  }
  return ((data ?? []) as { id: string }[]).length;
}