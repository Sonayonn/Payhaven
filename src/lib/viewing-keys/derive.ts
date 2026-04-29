import "server-only";
import {
  getMintViewingKeyDeriver,
  getMonthlyViewingKeyDeriver,
} from "@umbra-privacy/sdk";
import { getPrivyUmbraClient } from "@/lib/umbra/privy-umbra-client";
import { USDC_MAINNET_MINT } from "@/lib/umbra/constants";
import { log } from "@/lib/log";

export type DeriveBundleParams = {
  walletId: string;
  walletAddress: string;
  mintAddress: string;
  startYear: number;
  startMonth: number; // 1-12
  endYear: number;
  endMonth: number; // 1-12
};

export type AuditPackage = {
  granterAddress: string;
  token: string;
  period: string;
  viewingKeys: Record<string, string>; // "YYYY-MM" -> hex string
};

/**
 * Derive an audit package (JSON shape per Umbra docs) of monthly viewing keys
 * for a given mint + date range.
 *
 * SDK signatures per https://sdk.umbraprivacy.com/sdk/compliance-viewing-keys:
 *   getMonthlyViewingKeyDeriver({ client })  -> async (mint, year, month) => bigint
 *   year and month are branded bigint types (Year, Month), pass as `2026n as Year`.
 *
 * Keys are BN254 field elements (bigints). We export as `0x`-prefixed
 * 64-char-padded hex strings, the format Umbra's docs prescribe and that
 * any future Umbra-aware auditor tool will expect.
 */
export async function deriveAuditPackage(
  params: DeriveBundleParams,
): Promise<{ pkg: AuditPackage; monthCount: number }> {
  const client = await getPrivyUmbraClient({
    walletId: params.walletId,
    address: params.walletAddress,
  });

  const deriveMonthly = getMonthlyViewingKeyDeriver({ client });

  const months = enumerateMonths(
    params.startYear,
    params.startMonth,
    params.endYear,
    params.endMonth,
  );

  const viewingKeys: Record<string, string> = {};

  for (const { year, month } of months) {
    // Pass branded types, bigint cast to the SDK's Year/Month brands.
    // The mint deriver inside the monthly chain takes the raw mint address
    // string (per docs example: `await deriveMintVk(USDC)`).
    const key = (await deriveMonthly(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params.mintAddress as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      BigInt(year) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      BigInt(month) as any,
    )) as unknown as bigint;

    viewingKeys[formatMonthKey(year, month)] = bigintToHex(key);
  }

  const pkg: AuditPackage = {
    granterAddress: params.walletAddress,
    token: params.mintAddress,
    period: formatPeriod(params.startYear, params.startMonth, params.endYear, params.endMonth),
    viewingKeys,
  };

  log.info("Derived viewing-key audit package", {
    walletAddress: params.walletAddress,
    mintAddress: params.mintAddress,
    monthCount: months.length,
    period: pkg.period,
  });

  return { pkg, monthCount: months.length };
}

/**
 * Format a bigint as `0x`-prefixed 64-char-padded hex.
 * Matches Umbra docs convention for viewing-key export.
 */
function bigintToHex(n: bigint): string {
  return "0x" + n.toString(16).padStart(64, "0");
}

function formatMonthKey(year: number, month: number): string {
  return year + "-" + String(month).padStart(2, "0");
}

function formatPeriod(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): string {
  if (startYear === endYear && startMonth === endMonth) {
    return formatMonthKey(startYear, startMonth);
  }
  return formatMonthKey(startYear, startMonth) + ", " + formatMonthKey(endYear, endMonth);
}

function enumerateMonths(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    out.push({ year: y, month: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (out.length > 60) break; // Safety cap at 5 years
  }
  return out;
}

export { USDC_MAINNET_MINT };