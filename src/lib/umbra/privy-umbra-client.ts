import "server-only";
import { getUmbraClient } from "@umbra-privacy/sdk";
import type { IUmbraSigner } from "@umbra-privacy/sdk/interfaces";
import { env } from "@/lib/env";
import { UMBRA_INDEXER } from "./constants";
import { createPrivySigner } from "./privy-signer";
import { log } from "@/lib/log";

/**
 * Build an Umbra client for any Privy-owned wallet (sender or recipient).
 *
 * The client is not cached — each call constructs a fresh client because
 * the signer is bound to a specific walletId. Caching by walletId is a
 * future optimization; today, the master-seed derivation round-trip is
 * the only real cost and it's ~200ms per call.
 */
export async function getPrivyUmbraClient(params: {
  walletId: string;
  address: string;
}) {
  log.info("Initializing Privy-backed Umbra client", { address: params.address });

  const signer = createPrivySigner(params) as unknown as IUmbraSigner;

  const client = await getUmbraClient({
    signer,
    network: "mainnet",
    rpcUrl: env.SOLANA_RPC_URL,
    rpcSubscriptionsUrl: env.SOLANA_WS_URL,
    indexerApiEndpoint: UMBRA_INDEXER,
    deferMasterSeedSignature: true,
  });

  log.info("Privy-backed Umbra client ready", { address: params.address });

  return client;
}