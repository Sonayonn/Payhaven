/**
 * Umbra SDK constants.
 *
 * Single source of truth for mint addresses, RPC endpoints, and Umbra
 * infrastructure URLs. Any file that reaches for a magic string like
 * "EPjFWdd5..." is a bug — import from here instead.
 */

import { address } from "@solana/kit";

// USDC mainnet mint. Source: https://sdk.umbraprivacy.com/supported-tokens
export const USDC_MAINNET_MINT = address(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

// Umbra infrastructure endpoints. These should match what worked in the
// Day 1 scratch repo — see CONVENTIONS.md §1 for the doc-drift note on
// which URL is correct vs. which the docs name.
export const UMBRA_INDEXER = "https://utxo-indexer.api.umbraprivacy.com";
export const UMBRA_RELAYER = "https://relayer.api.umbraprivacy.com";

// Umbra's freshness window: 5 minutes. If a proof takes longer than this
// to land on-chain, the program rejects it with TimestampDifferenceExceedsMaximum.
// See CONVENTIONS.md §9.
export const UMBRA_FRESHNESS_WINDOW_SECONDS = 300;

// USDC has 6 decimals.
export const USDC_DECIMALS = 6;