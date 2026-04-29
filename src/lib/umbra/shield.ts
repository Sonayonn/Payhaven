import "server-only";
import { getPublicBalanceToEncryptedBalanceDirectDepositorFunction } from "@umbra-privacy/sdk";
import { address } from "@solana/kit";
import { getPrivyUmbraClient } from "./privy-umbra-client";
import { USDC_MAINNET_MINT } from "./constants";
import { log } from "@/lib/log";
import type { U64 } from "@umbra-privacy/sdk/types";

/**
 * Shield (deposit) USDC from a user's public ATA into their encrypted balance.
 *
 * On-chain footprint:
 *   - Publicly visible. Solscan shows: ATA → Umbra program, amount visible.
 *   - After this, public ATA is depleted by `amount`. Encrypted balance gains
 *     the equivalent. All future encrypted-balance sends are private.
 *
 * Operation timing:
 *   - Multi-tx with Arcium MPC callback. Total time: ~5-30s typically.
 *   - SDK waits for both handler tx + MPC callback to confirm before resolving.
 *
 * Per Day 8 lesson §13: `transaction-send` errors can mean "landed but timed out."
 * Don't auto-retry on that stage, verify on-chain first.
 *
 * Return shape per SDK's DepositResult:
 *   - queueSignature: the handler tx that queues the MPC computation (required)
 *   - callbackSignature: the Arcium MPC callback tx (present when MPC completes in time)
 *   - callbackElapsedMs: ms from queue to callback finalization
 *   - rentClaimSignature/Error: SDK auto-claims rent from the computation account;
 *     this is bookkeeping. Failure here doesn't fail the deposit itself.
 */

export type ShieldResult = {
  queueSignature: string;
  callbackSignature?: string;
  callbackElapsedMs?: number;
  rentClaimSignature?: string;
  rentClaimError?: string;
};

export async function shieldUsdc(params: {
  walletId: string;
  walletAddress: string;
  amountBaseUnits: bigint;
}): Promise<ShieldResult> {
  const client = await getPrivyUmbraClient({
    walletId: params.walletId,
    address: params.walletAddress,
  });

  const deposit = getPublicBalanceToEncryptedBalanceDirectDepositorFunction({
    client,
  });

  log.info("Shielding USDC: starting deposit", {
    address: params.walletAddress,
    amountBaseUnits: params.amountBaseUnits.toString(),
  });

  // Per docs: deposit(destinationAddress, mint, amount, options?)
  // destinationAddress is the user's own address (self-deposit to their encrypted balance).
  const result = await deposit(
    address(params.walletAddress),
    address(USDC_MAINNET_MINT),
    params.amountBaseUnits as unknown as U64,
  );

  log.info("Shield (deposit) succeeded", {
    address: params.walletAddress,
    queueSignature: result.queueSignature,
    callbackSignature: result.callbackSignature,
    callbackElapsedMs: result.callbackElapsedMs,
    rentClaimError: result.rentClaimError,
  });

  return {
    queueSignature: result.queueSignature as string,
    callbackSignature: result.callbackSignature as string | undefined,
    callbackElapsedMs: result.callbackElapsedMs,
    rentClaimSignature: result.rentClaimSignature as string | undefined,
    rentClaimError: result.rentClaimError,
  };
}