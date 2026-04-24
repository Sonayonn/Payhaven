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