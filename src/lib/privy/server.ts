import "server-only";
import { PrivyClient } from "@privy-io/server-auth";
import { env } from "@/lib/env";

let cached: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (cached) return cached;

  cached = new PrivyClient(
    env.NEXT_PUBLIC_PRIVY_APP_ID,
    env.PRIVY_APP_SECRET,
    {
      walletApi: {
        authorizationPrivateKey: env.PRIVY_AUTHORIZATION_KEY,
      },
    },
  );
  return cached;
}

/** Exposed for testing and forced re-init after env changes. Clears the cache. */
export function _resetPrivyClient(): void {
  cached = null;
}

export async function verifyPrivyToken(bearerToken: string): Promise<string> {
  const privy = getPrivyClient();
  const claims = await privy.verifyAuthToken(bearerToken);
  return claims.userId;
}

/**
 * Verify a Privy access token and also return the user's linked email/phone.
 *
 * Used on claim endpoints to check that the logged-in user matches the
 * recipient_identifier on a claim_token. Extends verifyPrivyToken by also
 * pulling the user record to extract linked email + phone identifiers.
 *
 * Returns null for email/phone if the user hasn't linked that account type.
 * A Privy user can have either, both, or (rare) neither depending on login method.
 */
export async function verifyPrivyTokenAndGetIdentifiers(
  bearerToken: string,
): Promise<{
  privyUserId: string;
  email: string | null;
  phone: string | null;
}> {
  const privy = getPrivyClient();
  const claims = await privy.verifyAuthToken(bearerToken);
  const user = await privy.getUserById(claims.userId);

  // Privy's linkedAccounts is a discriminated union. Email accounts have
  // `{ type: "email", address: string }`, phone accounts have
  // `{ type: "phone", number: string }`. Narrow by type + property presence.
  let email: string | null = null;
  let phone: string | null = null;

  for (const account of user.linkedAccounts ?? []) {
    if (account.type === "email" && "address" in account) {
      email = (account as { address: string }).address;
    } else if (account.type === "phone" && "number" in account) {
      phone = (account as { number: string }).number;
    }
  }

  return {
    privyUserId: claims.userId,
    email,
    phone,
  };
}