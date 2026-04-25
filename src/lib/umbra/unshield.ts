import "server-only";
import { getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction } from "@umbra-privacy/sdk";
import { address } from "@solana/kit";
import { getPrivyUmbraClient } from "./privy-umbra-client";
import { USDC_MAINNET_MINT } from "./constants";
import { log } from "@/lib/log";
import type { U64 } from "@umbra-privacy/sdk/types";

/**
 * Unshield (withdraw) USDC from a user's encrypted balance back to their public ATA.
 *
 * On-chain footprint:
 *   - Publicly visible. Solscan shows: Umbra program → user's public ATA, amount visible.
 *   - This is the moment privacy ends for the withdrawn amount. After this, anyone
 *     watching the public ATA sees the USDC arrived. They CANNOT see where it came
 *     from (mixer breaks linkability), but they see "X USDC arrived at this address."
 *
 * Operation timing:
 *   - Multi-tx with Arcium MPC callback. Total time: ~5-30s.
 *
 * Use cases:
 *   - Recipient wants to offramp to fiat: unshield → public ATA → send to Bitnob/etc
 *   - User wants to spend at a non-Umbra merchant: unshield → public ATA → SPL transfer
 *   - User wants to consolidate to Phantom for self-custody: unshield → public ATA → transfer
 */

export type UnshieldResult = {
  /** Handler tx — confirms on Solana before MPC kicks off. */
  queueSignature: string;
  /** Arcium MPC callback. Present when MPC computation completed. */
  callbackSignature?: string;
  /** Wall-clock ms spent waiting for MPC callback. */
  callbackElapsedMs?: number;
};

export async function unshieldUsdc(params: {
  walletId: string;
  walletAddress: string;
  amountBaseUnits: bigint;
}): Promise<UnshieldResult> {
  const client = await getPrivyUmbraClient({
    walletId: params.walletId,
    address: params.walletAddress,
  });

  const withdraw = getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction({
    client,
  });

  log.info("Unshielding USDC: starting withdrawal", {
    address: params.walletAddress,
    amountBaseUnits: params.amountBaseUnits.toString(),
  });

  // Per docs: withdraw(destinationAddress, mint, amount, options?)
  // destinationAddress = the user's own address (withdraws to their own public ATA).
  const result = await withdraw(
    address(params.walletAddress),
    address(USDC_MAINNET_MINT),
    params.amountBaseUnits as unknown as U64,
  );

  log.info("Unshield (withdrawal) succeeded", {
    address: params.walletAddress,
    queueSignature: result.queueSignature,
    callbackSignature: result.callbackSignature,
    callbackElapsedMs: result.callbackElapsedMs,
  });

  return {
    queueSignature: result.queueSignature as string,
    callbackSignature: result.callbackSignature as string | undefined,
    callbackElapsedMs: result.callbackElapsedMs,
  };
}