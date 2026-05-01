import "server-only";
import { createSolanaRpc, address } from "@solana/kit";
import { env } from "@/lib/env";

/**
 * Per-operation SOL budget for Payhaven actions.
 *
 * Empirically calibrated from mainnet testing:
 *   - Shield (deposit): ~0.003 SOL (2 txs)
 *   - Encrypted-balance send: ~0.005 SOL (3-4 txs)
 *   - Unshield: ~0.003 SOL (2 txs)
 *   - Claim: ~0.004 SOL (2-3 txs)
 *
 * We use 0.005 as the conservative "one operation" budget.
 */
export const SOL_PER_OPERATION = 0.005;
export const SOL_PER_OPERATION_LAMPORTS = 5_000_000n;

/**
 * Health thresholds for the dashboard gas indicator.
 *   - healthy: 3+ operations buffered (≥ 0.015 SOL)
 *   - low: 1-3 operations remaining (0.005-0.015 SOL)
 *   - empty: next operation will likely fail (< 0.005 SOL)
 */
export const SOL_THRESHOLD_HEALTHY_LAMPORTS = 15_000_000n;
export const SOL_THRESHOLD_LOW_LAMPORTS = 5_000_000n;

export type GasHealth = "healthy" | "low" | "empty";

export type SolBalanceResult = {
  /** Raw balance in lamports as a string (preserves bigint precision in JSON). */
  lamports: string;
  /** Decimal SOL display value, e.g. "0.0123". */
  solDisplay: string;
  /** Approximate number of remaining Payhaven operations the balance covers. */
  operationsRemaining: number;
  /** Bucketed health for UI color-coding. */
  health: GasHealth;
};

/**
 * Read a wallet's lamport balance from the Solana RPC.
 *
 * Read-only — no signing, no on-chain mutation, ~150ms RPC roundtrip.
 *
 * On RPC failure we throw so callers can surface the issue. We don't
 * silently return zero, because zero would falsely show "out of gas"
 * and trigger user-visible warnings.
 */
export async function getSolBalance(walletAddress: string): Promise<SolBalanceResult> {
  const rpc = createSolanaRpc(env.SOLANA_RPC_URL);
  const result = await rpc.getBalance(address(walletAddress)).send();

  // result.value is a bigint of lamports
  const lamports = result.value;
  const sol = Number(lamports) / 1_000_000_000;
  const operationsRemaining = Math.floor(Number(lamports) / Number(SOL_PER_OPERATION_LAMPORTS));

  let health: GasHealth = "empty";
  if (lamports >= SOL_THRESHOLD_HEALTHY_LAMPORTS) {
    health = "healthy";
  } else if (lamports >= SOL_THRESHOLD_LOW_LAMPORTS) {
    health = "low";
  }

  return {
    lamports: lamports.toString(),
    solDisplay: sol.toFixed(4),
    operationsRemaining,
    health,
  };
}

/**
 * Pre-flight gas sufficiency check used by shield/send/unshield routes.
 *
 * Returns null if balance is sufficient, or a structured error payload
 * the route can surface as a friendly message.
 */
export async function checkGasSufficient(walletAddress: string): Promise<
  | null
  | {
      code: "INSUFFICIENT_GAS";
      message: string;
      solDisplay: string;
      lamports: string;
    }
  > {
  const balance = await getSolBalance(walletAddress);
  // We require at least one operation's worth of SOL.
  if (BigInt(balance.lamports) >= SOL_PER_OPERATION_LAMPORTS) {
    return null;
  }
  return {
    code: "INSUFFICIENT_GAS",
    message: `Not enough SOL for network fees. You have ${balance.solDisplay} SOL but need at least ${SOL_PER_OPERATION.toFixed(3)} SOL per transaction. Add SOL to your Payhaven wallet to continue.`,
    solDisplay: balance.solDisplay,
    lamports: balance.lamports,
  };
}