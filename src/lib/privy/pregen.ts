import "server-only";
import { getPrivyClient } from "@/lib/privy/server";
import { env } from "@/lib/env";
import { findExistingRecipientWallet } from "@/lib/claim-tokens/server";
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
 * Emails: lowercased + trimmed. Prevents "Oliver@..." and "oliver@..."
 * from spawning two wallets for the same person.
 *
 * Phone numbers: stripped to digits-and-leading-+ (E.164 format).
 * "+234 812 345 6789", "+234-812-345-6789", and "+2348123456789" all
 * collapse to "+2348123456789". Without the + prefix, we reject the
 * input — we don't want to guess a country code.
 *
 * Run at the edge before any DB lookup. Storing the normalized form in
 * claim_tokens.recipient_identifier guarantees dedup works the next time
 * the same recipient comes up, regardless of how it was originally typed.
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

export async function pregenerateRecipientWallet(
  identifier: string,
  kind: "email" | "phone",
): Promise<PregenResult> {
  // Normalize FIRST so dedup, logging, and persistence all use the same
  // canonical form. If the user types "Oliver@X.com" today and
  // "oliver@x.com" tomorrow, both hit the same wallet.
  const normalized = normalizeIdentifier(identifier, kind);

  // Dedup: if we've sent to this identifier before, reuse that wallet.
  // This is what makes "same email → same wallet" work, and it's why the
  // repeat-send path is cheap (no Privy createWallet, no SOL funding,
  // no Umbra registration).
  const existing = await findExistingRecipientWallet(normalized);
  if (existing) {
    log.info("Reusing existing recipient wallet", {
      kind,
      identifier: normalized,
      walletId: existing.walletId,
      solanaAddress: existing.address,
      previouslyRegistered: existing.umbraRegisteredAt !== null,
    });
    return {
      solanaAddress: existing.address,
      privyUserId: null,
      walletId: existing.walletId,
      reused: true,
      previouslyRegistered: existing.umbraRegisteredAt !== null,
    };
  }

  // First time seeing this identifier — create a fresh server-owned wallet.
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