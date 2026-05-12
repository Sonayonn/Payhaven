import "server-only";
import { getPrivyClient } from "@/lib/privy/server";
import { env } from "@/lib/env";
import {
  findServerWalletByPrivyUserId,
  insertServerWallet,
  adoptExistingWalletForUser,
  markServerWalletUmbraRegistered,
  type ServerWallet,
} from "@/lib/server-wallets/server";
import { findExistingRecipientWallet } from "@/lib/claim-tokens/server";
import { normalizeIdentifier } from "@/lib/privy/pregen";
import { registerWalletIfNeeded } from "@/lib/umbra/wallet-registration";
import { log } from "@/lib/log";

const inFlightProvisioning = new Map<string, Promise<ServerWallet>>();

export type LinkedIdentifiers = {
  email: string | null;
  phone: string | null;
};

/**
 * Get or provision the sender's Payhaven wallet.
 *
 * Resolution order on first login:
 *   1. Existing server_wallets row for this privyUserId, fast path, ~20ms.
 *   2. Recipient wallet pregenerated for any of this user's linked
 *      identifiers (email, phone), adopt it. This is what guarantees
 *      "claim → log in → see your money."
 *   3. Mint a brand new server-owned Privy wallet, register with Umbra.
 *
 * `linkedIdentifiers` MUST be passed on first login so step 2 can run.
 * Pass an empty object if you genuinely don't have them yet, the function
 * will still work, but a returning recipient will see a fresh empty wallet
 * instead of the one holding their balance. That's the bug we're fixing,
 * so don't.
 */
export async function ensureSenderWallet(
  privyUserId: string,
  linkedIdentifiers: LinkedIdentifiers,
): Promise<ServerWallet> {
  const inFlight = inFlightProvisioning.get(privyUserId);
  if (inFlight) {
    log.info("Joining in-flight sender wallet provisioning", { privyUserId });
    return inFlight;
  }

  const promise = doEnsureSenderWallet(privyUserId, linkedIdentifiers);
  inFlightProvisioning.set(privyUserId, promise);
  try {
    return await promise;
  } finally {
    inFlightProvisioning.delete(privyUserId);
  }
}

async function doEnsureSenderWallet(
  privyUserId: string,
  linkedIdentifiers: LinkedIdentifiers,
): Promise<ServerWallet> {
  // 1. Existing server_wallets row, fast path.
  const existing = await findServerWalletByPrivyUserId(privyUserId);
  if (existing && existing.umbraRegisteredAt !== null) {
    log.info("Sender wallet already provisioned", {
      privyUserId,
      solanaAddress: existing.solanaAddress,
    });
    return existing;
  }

  // 2. No row, but a recipient wallet may already exist for this person's
  //    email or phone (someone has sent them money before they signed up).
  //    Adopt it. This is the bug fix.
  if (!existing) {
    const adopted = await tryAdoptRecipientWallet(privyUserId, linkedIdentifiers);
    if (adopted) {
      // If the adopted wallet was already Umbra-registered (~always true,
      // since claiming requires registration), we're done. Otherwise fall
      // through to the registration path below using the adopted wallet.
      if (adopted.umbraRegisteredAt !== null) return adopted;

      log.info(
        "Adopted existing recipient wallet; completing Umbra registration",
        { privyUserId, solanaAddress: adopted.solanaAddress },
      );
      await registerWalletIfNeeded({
        walletId: adopted.walletId,
        address: adopted.solanaAddress,
      });
      await markServerWalletUmbraRegistered(privyUserId);
      return { ...adopted, umbraRegisteredAt: new Date().toISOString() };
    }
  }

  // 3. Truly new user, mint a server-owned Privy wallet, then register.
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
    log.info("Sender wallet exists but unregistered, completing registration", {
      privyUserId,
      solanaAddress: wallet.solanaAddress,
    });
  }

  await registerWalletIfNeeded({
    walletId: wallet.walletId,
    address: wallet.solanaAddress,
  });
  await markServerWalletUmbraRegistered(privyUserId);

  return { ...wallet, umbraRegisteredAt: new Date().toISOString() };
}

/**
 * Look up linked identifiers in claim_tokens and adopt the wallet if found.
 *
 * Tries email first, then phone. The first hit wins; in the rare case where
 * a user has both a previously-pregenerated email wallet AND a separate
 * phone wallet, we adopt the email one and the phone wallet becomes orphaned.
 * That's a legitimate edge case (one human, two contact methods, money sent
 * to both before either was claimed), log a warning and document in DEBT.
 *
 * Returns null if no recipient wallet exists for any linked identifier.
 */
async function tryAdoptRecipientWallet(
  privyUserId: string,
  linked: LinkedIdentifiers,
): Promise<ServerWallet | null> {
  const candidates: { kind: "email" | "phone"; raw: string }[] = [];
  if (linked.email) candidates.push({ kind: "email", raw: linked.email });
  if (linked.phone) candidates.push({ kind: "phone", raw: linked.phone });

  for (const candidate of candidates) {
    let normalized: string;
    try {
      normalized = normalizeIdentifier(candidate.raw, candidate.kind);
    } catch (err) {
      // E.164 phone parse failures are non-fatal, skip and try next.
      log.warn("Could not normalize identifier during adoption", {
        privyUserId,
        kind: candidate.kind,
        err: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const recipientWallet = await findExistingRecipientWallet(normalized);
    if (!recipientWallet) continue;

    log.info("Adopting recipient wallet for new login", {
      privyUserId,
      kind: candidate.kind,
      identifier: normalized,
      walletId: recipientWallet.walletId,
      solanaAddress: recipientWallet.address,
      previouslyRegistered: recipientWallet.umbraRegisteredAt !== null,
    });

    return adoptExistingWalletForUser({
      privyUserId,
      walletId: recipientWallet.walletId,
      solanaAddress: recipientWallet.address,
      umbraRegisteredAt: recipientWallet.umbraRegisteredAt,
    });
  }

  return null;
}