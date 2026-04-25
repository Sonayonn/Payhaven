import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { verifyPrivyToken } from "@/lib/privy/server";
import { ensureSenderWallet } from "@/lib/privy/sender-wallet";
import { getEncryptedUsdcBalance } from "@/lib/umbra/encrypted-balance";

/**
 * GET /api/encrypted-balance
 *
 * Returns the authenticated user's encrypted USDC balance.
 * Read-only — no on-chain mutation, no SOL spent.
 *
 * Response shape:
 *   { ok: true, state: "shared" | "non_existent" | ..., balanceBaseUnits: "1234567" }
 *
 * Frontend converts balanceBaseUnits to display: Number(balanceBaseUnits) / 1_000_000.
 * Returned as string to avoid JSON precision loss for large values (low risk for USDC,
 * but matches the pattern we use elsewhere).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return apiError("UNAUTHORIZED", "Missing Authorization header");
  }

  let privyUserId: string;
  try {
    privyUserId = await verifyPrivyToken(token);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  let wallet;
  try {
    wallet = await ensureSenderWallet(privyUserId);
  } catch (err) {
    return apiError("UPSTREAM_ERROR", "Failed to resolve wallet", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }

  let balance;
  try {
    balance = await getEncryptedUsdcBalance({
      walletId: wallet.walletId,
      address: wallet.solanaAddress,
    });
  } catch (err) {
    log.error("Encrypted balance query failed", {
      address: wallet.solanaAddress,
      err: err instanceof Error ? err.message : String(err),
    });
    return apiError("UPSTREAM_ERROR", "Failed to query encrypted balance");
  }

  return Response.json({
    ok: true,
    state: balance.state,
    balanceBaseUnits: balance.balanceBaseUnits.toString(),
  });
}