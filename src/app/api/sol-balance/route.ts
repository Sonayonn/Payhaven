import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { verifyPrivyToken } from "@/lib/privy/server";
import { ensureSenderWallet } from "@/lib/privy/sender-wallet";
import { getSolBalance } from "@/lib/umbra/sol-balance";

/**
 * GET /api/sol-balance
 *
 * Returns the authenticated user's SOL balance and gas health for the
 * dashboard indicator. Read-only — no signing, no on-chain mutation.
 *
 * Polled by the dashboard alongside /api/sender-wallet and
 * /api/encrypted-balance to keep the gas indicator fresh.
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
    balance = await getSolBalance(wallet.solanaAddress);
  } catch (err) {
    log.error("SOL balance read failed", {
      address: wallet.solanaAddress,
      err: err instanceof Error ? err.message : String(err),
    });
    return apiError("UPSTREAM_ERROR", "Failed to read SOL balance");
  }

  return Response.json({
    ok: true,
    lamports: balance.lamports,
    solDisplay: balance.solDisplay,
    operationsRemaining: balance.operationsRemaining,
    health: balance.health,
  });
}