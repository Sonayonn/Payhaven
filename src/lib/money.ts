/**
 * Money, unit conversion for token amounts at trust boundaries.
 *
 * USDC has 6 decimals: 1 USDC = 1_000_000 base units (on-chain representation).
 *
 * Rule (see CONVENTIONS.md §2):
 *   - Validate at trust boundaries using functions here.
 *   - Cast freely inside a single trust context.
 *   - Never let a bigint cross a boundary without being sure whose decimals it's in.
 */

import { z } from "zod";

// USDC (mainnet) decimal precision, token's on-chain decimals field.
const USDC_DECIMALS = 6;

// Solana's SPL token amounts are u64. U64_MAX = 2^64 - 1.
const U64_MAX = 18_446_744_073_709_551_615n;

// Reasonable upper bound for a single remittance: $1,000,000. Rejects obvious
// mistakes (fat-finger an extra zero, pass a wrong unit) without restricting
// real-world use cases. Not a limit on Payhaven's product scope, a tripwire.
const MAX_HUMAN_USDC = 1_000_000;

/**
 * Branded type representing USDC in base units (6-decimal).
 * Cast as `bigint & { readonly __brand: "UsdcBaseUnits" }` inside trusted code;
 * use the validators here to produce values at edges.
 */
export type UsdcBaseUnits = bigint & { readonly __brand: "UsdcBaseUnits" };

const humanUsdcSchema = z
  .number()
  .finite("USDC amount must be a finite number")
  .nonnegative("USDC amount must be >= 0")
  .lte(MAX_HUMAN_USDC, `USDC amount must be <= ${MAX_HUMAN_USDC}`);

const baseUnitsSchema = z
  .bigint()
  .nonnegative("Base units must be >= 0")
  .refine((v) => v <= U64_MAX, "Base units exceed U64 max");

/**
 * Convert a human-readable USDC amount to on-chain base units.
 *
 * @example
 *   usdcToBaseUnits(200)      // 200_000_000n  (200 USDC)
 *   usdcToBaseUnits(0.5)      //     500_000n  (50 cents)
 *   usdcToBaseUnits(0.000001) //          1n   (1 base unit)
 *
 * Throws ZodError on invalid input (NaN, negative, too large, non-number).
 */
export function usdcToBaseUnits(humanAmount: number): UsdcBaseUnits {
  const validated = humanUsdcSchema.parse(humanAmount);

  // Multiply in string space to avoid floating-point loss on small fractional
  // amounts. toFixed(6) forces a 6-decimal representation, then we strip the
  // decimal point to get the base-unit integer.
  //
  // Example: 0.1 * 1_000_000 = 100000.00000000001 in IEEE 754. Bad.
  //          toFixed(6) of 0.1 = "0.100000". Strip dot = "0100000" = 100_000. Good.
  const fixed = validated.toFixed(USDC_DECIMALS);
  const [whole = "0", fraction = ""] = fixed.split(".");
  const combined = whole + fraction.padEnd(USDC_DECIMALS, "0");

  // Strip leading zeros (BigInt accepts them, but it's good hygiene), but keep
  // at least one digit so "0" doesn't become "".
  const normalized = combined.replace(/^0+(?=\d)/, "");

  return BigInt(normalized) as UsdcBaseUnits;
}

/**
 * Convert on-chain USDC base units back to a human-readable number.
 *
 * @example
 *   baseUnitsToUsdc(200_000_000n) // 200
 *   baseUnitsToUsdc(500_000n)     // 0.5
 *   baseUnitsToUsdc(1n)           // 0.000001
 *
 * Throws ZodError if base units are negative or exceed U64 max.
 *
 * WARNING: converting very large base-unit values may lose precision in JS
 * Number (which is IEEE 754 double). For display amounts under ~$1B this is
 * safe; for treasury-scale accounting, keep the bigint.
 */
export function baseUnitsToUsdc(base: UsdcBaseUnits | bigint): number {
  const validated = baseUnitsSchema.parse(base);
  const divisor = 10n ** BigInt(USDC_DECIMALS);
  const whole = validated / divisor;
  const fraction = validated % divisor;
  const fractionStr = fraction.toString().padStart(USDC_DECIMALS, "0");
  return Number(`${whole}.${fractionStr}`);
}