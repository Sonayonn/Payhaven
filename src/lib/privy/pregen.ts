import "server-only";
import { getPrivyClient } from "@/lib/privy/server";
import { env } from "@/lib/env";
import { findExistingRecipientWallet } from "@/lib/claim-tokens/server";
import { findServerWalletByIdentifier } from "@/lib/server-wallets/by-identifier";
import { log } from "@/lib/log";

export type PregenResult = {
  solanaAddress: string;
  privyUserId: string | null;
  walletId: string;
  reused: boolean;
  previouslyRegistered: boolean;
};

/**
 * Normalize a recipient identifier before dedup lookup and persistence.
 *
 * Emails: lowercased + trimmed.
 * Phone numbers: stripped to E.164 format. Without the + prefix, we reject —
 * we don't want to guess a country code.
 *
 * Storing the normalized form in claim_tokens.recipient_identifier guarantees
 * dedup works the next time the same recipient comes up, regardless of input
 * formatting.
 */
export function normalizeIdentifier(
  identifier: string,
  kind: "email" | "phone",
): string {
  if (kind === "email") {
    return identifier.trim().toLowerCase();
  }
  const digits = identifier.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) {
    throw new Error(
      `Phone number must be in E.164 format (e.g., +2348123456789). Got: ${identifier}`,
    );
  }
  return digits;
}

/**
 * Resolve a recipient wallet for a send. Wallet identity converges across
 * three sources, in priority order:
 *
 *   1. claim_tokens, a prior pregen exists for this email/phone. Reuse it.
 *      If pending UTXOs are sitting at this address, new UTXOs land beside
 *      them and the same recipient claims everything together.
 *
 *   2. server_wallets, no prior pregen, but the recipient is already a
 *      logged-in Payhaven user with this email/phone. Adopt their wallet
 *      so received UTXOs show up in the dashboard they actually log into.
 *      This was the bug fix where someone sent to a registered user and
 *      the funds landed in a fresh wallet the user couldn't see.
 *
 *   3. Mint fresh, the recipient has no Payhaven presence yet. Create a
 *      pregen wallet they'll claim into.
 *
 * Race note: two simultaneous sends to a brand-new identifier could both
 * miss steps 1+2 and mint two wallets. Privy lookup (privy.getUserByEmail)
 * would dedup further but adds 200-500ms per send. Documented in DEBT.md
 * as acceptable for the hackathon, the only failure mode is duplicate
 * wallets for first-ever sends to the same identifier within milliseconds.
 */
export async function pregenerateRecipientWallet(
  identifier: string,
  kind: "email" | "phone",
): Promise<PregenResult> {
  const normalized = normalizeIdentifier(identifier, kind);

  // Path 1: prior recipient pregen
  const priorPregen = await findExistingRecipientWallet(normalized);
  if (priorPregen) {
    log.info("Reusing existing recipient pregen", {
      kind,
      identifier: normalized,
      walletId: priorPregen.walletId,
      solanaAddress: priorPregen.address,
      previouslyRegistered: priorPregen.umbraRegisteredAt !== null,
    });
    return {
      solanaAddress: priorPregen.address,
      privyUserId: null,
      walletId: priorPregen.walletId,
      reused: true,
      previouslyRegistered: priorPregen.umbraRegisteredAt !== null,
    };
  }

  // Path 2: existing server_wallet for this identifier (registered Payhaven user)
  const existingUserWallet = await findServerWalletByIdentifier(
    normalized,
    kind,
  );
  if (existingUserWallet) {
    log.info("Adopting existing user wallet for recipient pregen", {
      kind,
      identifier: normalized,
      walletId: existingUserWallet.walletId,
      solanaAddress: existingUserWallet.address,
      previouslyRegistered: existingUserWallet.umbraRegisteredAt !== null,
    });
    return {
      solanaAddress: existingUserWallet.address,
      privyUserId: null,
      walletId: existingUserWallet.walletId,
      reused: true,
      previouslyRegistered: existingUserWallet.umbraRegisteredAt !== null,
    };
  }

  // Path 3: mint fresh, first time anyone has interacted with this identifier
  const privy = getPrivyClient();
  const wallet = await privy.walletApi.createWallet({
    chainType: "solana",
    ownerId: env.PRIVY_AUTHORIZATION_PUBLIC_KEY,
  });

  if (wallet.ownerId !== env.PRIVY_AUTHORIZATION_PUBLIC_KEY) {
    throw new Error(
      `Wallet ownership did not apply. Expected ${env.PRIVY_AUTHORIZATION_PUBLIC_KEY}, got ${wallet.ownerId}. Wallet ${wallet.id} is orphaned.`,
    );
  }

  log.info("Created new server-owned recipient wallet", {
    kind,
    identifier: normalized,
    walletId: wallet.id,
    solanaAddress: wallet.address,
    ownerId: wallet.ownerId,
  });

  return {
    solanaAddress: wallet.address,
    privyUserId: null,
    walletId: wallet.id,
    reused: false,
    previouslyRegistered: false,
  };
}