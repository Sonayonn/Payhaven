import "server-only";
import { getSupabase } from "@/lib/supabase/server";

/**
 * Server wallet repository.
 *
 * One wallet per Privy user. Created on first login, reused forever.
 * The `umbra_registered_at` timestamp lets us skip Umbra registration on
 * subsequent operations — a non-null value means the wallet's X25519 key
 * is on-chain and ready to receive or create UTXOs.
 */

export type ServerWallet = {
  id: string;
  privyUserId: string;
  walletId: string;
  solanaAddress: string;
  umbraRegisteredAt: string | null;
  createdAt: string;
};

export async function findServerWalletByPrivyUserId(
  privyUserId: string,
): Promise<ServerWallet | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("server_wallets")
    .select("*")
    .eq("privy_user_id", privyUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to query server_wallets: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id as string,
    privyUserId: data.privy_user_id as string,
    walletId: data.wallet_id as string,
    solanaAddress: data.solana_address as string,
    umbraRegisteredAt: data.umbra_registered_at as string | null,
    createdAt: data.created_at as string,
  };
}

export async function insertServerWallet(input: {
  privyUserId: string;
  walletId: string;
  solanaAddress: string;
}): Promise<ServerWallet> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("server_wallets")
    .insert({
      privy_user_id: input.privyUserId,
      wallet_id: input.walletId,
      solana_address: input.solanaAddress,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to insert server_wallet: ${error?.message ?? "no data"}`,
    );
  }

  return {
    id: data.id as string,
    privyUserId: data.privy_user_id as string,
    walletId: data.wallet_id as string,
    solanaAddress: data.solana_address as string,
    umbraRegisteredAt: data.umbra_registered_at as string | null,
    createdAt: data.created_at as string,
  };
}

export async function markServerWalletUmbraRegistered(
  privyUserId: string,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("server_wallets")
    .update({
      umbra_registered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("privy_user_id", privyUserId);

  if (error) {
    throw new Error(
      `Failed to mark server_wallet registered: ${error.message}`,
    );
  }
}