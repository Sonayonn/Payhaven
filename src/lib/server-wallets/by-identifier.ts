import "server-only";
import { getPrivyClient } from "@/lib/privy/server";
import { findServerWalletByPrivyUserId } from "./server";
import { log } from "@/lib/log";

/**
 * Find a server_wallets row by email or phone, going through Privy.
 *
 * Privy is the source of truth for "what userId owns this email." Once we
 * have the userId, we look up server_wallets normally. If Privy doesn't
 * know the email/phone, no wallet exists for that identifier yet.
 *
 * Used during recipient pregen to converge sender-wallet and recipient-wallet
 * paths to the same wallet when the same person is on both sides over time.
 *
 * Returns null when:
 *   - Privy has no user with that email/phone
 *   - Privy has the user but server_wallets has no row for them yet
 *   - Privy lookup throws (we fail open, caller will mint a fresh pregen)
 */
export async function findServerWalletByIdentifier(
  identifier: string,
  kind: "email" | "phone",
): Promise<{
  walletId: string;
  address: string;
  umbraRegisteredAt: string | null;
} | null> {
  const privy = getPrivyClient();

  let user;
  try {
    user =
      kind === "email"
        ? await privy.getUserByEmail(identifier)
        : await privy.getUserByPhoneNumber(identifier);
  } catch (err) {
    // Privy throws on "not found" rather than returning null. Treat all
    // throws as "no user," log once for visibility.
    log.info("Privy lookup returned no user", {
      kind,
      identifier,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (!user) return null;

  const wallet = await findServerWalletByPrivyUserId(user.id);
  if (!wallet) {
    log.info("Privy user exists but has no server_wallet yet", {
      kind,
      identifier,
      privyUserId: user.id,
    });
    return null;
  }

  return {
    walletId: wallet.walletId,
    address: wallet.solanaAddress,
    umbraRegisteredAt: wallet.umbraRegisteredAt,
  };
}