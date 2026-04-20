import "server-only";
import { PrivyClient } from "@privy-io/server-auth";
import { env } from "@/lib/env";

let cached: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (cached) return cached;
  cached = new PrivyClient(env.NEXT_PUBLIC_PRIVY_APP_ID, env.PRIVY_APP_SECRET);
  return cached;
}

/**
 * Verifies a Privy access token from an incoming request.
 * Returns the Privy user DID (a stable ID like "did:privy:abc...") on success,
 * throws on invalid/expired/missing token.
 */
export async function verifyPrivyToken(bearerToken: string): Promise<string> {
  const privy = getPrivyClient();
  const claims = await privy.verifyAuthToken(bearerToken);
  return claims.userId;
}