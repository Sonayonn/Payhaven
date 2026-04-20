/**
 * Treasury Umbra client — server-only.
 *
 * Loaded lazily on first use, cached for the process lifetime. Do NOT import
 * from client components; this pulls in server-only dependencies and the
 * treasury secret key.
 *
 * Architectural debt: single hot keypair. See DEBT.md for the multi-sig
 * upgrade path before public mainnet launch.
 */

import "server-only";
import bs58 from "bs58";
import {
  getUmbraClient,
  createSignerFromPrivateKeyBytes,
} from "@umbra-privacy/sdk";
import { env } from "@/lib/env";
import { UMBRA_INDEXER } from "./constants";
import { log } from "@/lib/log";

let cachedClient: Awaited<ReturnType<typeof getUmbraClient>> | null = null;

export async function getTreasuryUmbraClient() {
  if (cachedClient) return cachedClient;

  log.info("Initializing treasury Umbra client");

  // Decode the base58 secret key. bs58.decode returns Uint8Array.
  const keyBytes = bs58.decode(env.TREASURY_SECRET_KEY_B58);
  if (keyBytes.length !== 64) {
    throw new Error(
      `TREASURY_SECRET_KEY_B58 decoded to ${keyBytes.length} bytes; expected 64`,
    );
  }

  const signer = await createSignerFromPrivateKeyBytes(keyBytes);

  const client = await getUmbraClient({
    signer,
    network: "mainnet",
    rpcUrl: env.SOLANA_RPC_URL,
    rpcSubscriptionsUrl: env.SOLANA_WS_URL,
    indexerApiEndpoint: UMBRA_INDEXER,
    // Server-side: no wallet prompt ever, derive seed on first key operation.
    deferMasterSeedSignature: true,
  });

  cachedClient = client;
  log.info("Treasury Umbra client ready", { address: signer.address });

  return client;
}

/** Exposed for testing and health checks. Clears the cache. */
export function _resetTreasuryClient(): void {
  cachedClient = null;
}
