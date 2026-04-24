import "server-only";
import { getPrivyClient } from "@/lib/privy/server";
import { env } from "@/lib/env";
import {
  findServerWalletByPrivyUserId,
  insertServerWallet,
  markServerWalletUmbraRegistered,
  type ServerWallet,
} from "@/lib/server-wallets/server";
import { registerWalletIfNeeded } from "@/lib/umbra/wallet-registration";
import { log } from "@/lib/log";

/**
 * Process-local lock keyed by privyUserId. Prevents React StrictMode's
 * double-invoke (and any concurrent client refetch) from racing the
 * registration flow and creating duplicate wallets / double-spending
 * the registration funding tx.
 *
 * Single-process only. Multi-instance deployments need a Supabase advisory
 * lock or Redis mutex. Tracked in DEBT.md.
 */
const inFlightProvisioning = new Map<string, Promise<ServerWallet>>();

/**
 * Get or provision the sender's Payhaven wallet.
 *
 * On first login, this creates a server-owned Privy wallet, registers it
 * with Umbra (so it can create UTXOs), and persists the mapping. On
 * subsequent logins, returns the existing wallet — no Privy call, no
 * Umbra call, ~20ms Supabase read.
 *
 * The wallet is the user's Payhaven account. They fund it from Phantom or
 * a CEX. It signs UTXO-creation transactions. Treasury is not involved
 * except as a gas sponsor on the one-time registration.
 */
export async function ensureSenderWallet(
  privyUserId: string,
): Promise<ServerWallet> {
  const inFlight = inFlightProvisioning.get(privyUserId);
  if (inFlight) {
    log.info("Joining in-flight sender wallet provisioning", { privyUserId });
    return inFlight;
  }

  const promise = doEnsureSenderWallet(privyUserId);
  inFlightProvisioning.set(privyUserId, promise);
  try {
    return await promise;
  } finally {
    inFlightProvisioning.delete(privyUserId);
  }
}

async function doEnsureSenderWallet(
  privyUserId: string,
): Promise<ServerWallet> {
  // Fast path: existing wallet already provisioned and registered.
  const existing = await findServerWalletByPrivyUserId(privyUserId);
  if (existing && existing.umbraRegisteredAt !== null) {
    log.info("Sender wallet already provisioned", {
      privyUserId,
      solanaAddress: existing.solanaAddress,
    });
    return existing;
  }

  // Two sub-cases:
  //   (a) No row exists — create Privy wallet, insert row, register, mark
  //   (b) Row exists but umbra_registered_at is null — retry registration only
  let wallet: ServerWallet;

  if (!existing) {
    const privy = getPrivyClient();
    const privyWallet = await privy.walletApi.createWallet({
      chainType: "solana",
      ownerId: env.PRIVY_AUTHORIZATION_PUBLIC_KEY,
    });

    if (privyWallet.ownerId !== env.PRIVY_AUTHORIZATION_PUBLIC_KEY) {
      throw new Error(
        `Wallet ownership did not apply. Expected ${env.PRIVY_AUTHORIZATION_PUBLIC_KEY}, got ${privyWallet.ownerId}. Wallet ${privyWallet.id} is orphaned.`,
      );
    }

    wallet = await insertServerWallet({
      privyUserId,
      walletId: privyWallet.id,
      solanaAddress: privyWallet.address,
    });

    log.info("Provisioned new sender wallet", {
      privyUserId,
      walletId: wallet.walletId,
      solanaAddress: wallet.solanaAddress,
    });
  } else {
    wallet = existing;
    log.info("Sender wallet exists but unregistered — completing registration", {
      privyUserId,
      solanaAddress: wallet.solanaAddress,
    });
  }

  // Register with Umbra (funds if needed, retries on timeout).
  await registerWalletIfNeeded({
    walletId: wallet.walletId,
    address: wallet.solanaAddress,
  });

  await markServerWalletUmbraRegistered(privyUserId);

  return {
    ...wallet,
    umbraRegisteredAt: new Date().toISOString(),
  };
}