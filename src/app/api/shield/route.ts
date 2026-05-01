import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { verifyPrivyTokenAndGetIdentifiers } from "@/lib/privy/server";
import { ensureSenderWallet } from "@/lib/privy/sender-wallet";
import { checkGasSufficient } from "@/lib/umbra/sol-balance";
import { usdcToBaseUnits } from "@/lib/money";
import { shieldUsdc } from "@/lib/umbra/shield";

/**
 * POST /api/shield, move USDC from user's public ATA to their encrypted balance.
 *
 * Body: { amountUsdc: number }
 *
 * Returns the queue tx signature + Arcium MPC callback signature on success.
 * Operation takes 5-30s due to MPC callback wait.
 *
 * Failure modes:
 *   - User has insufficient public USDC balance, caller validates this before submitting
 *   - User not registered (shouldn't happen, registration is on first login)
 *   - Arcium MPC callback times out, per Day 8 lesson, log and surface; user should
 *     check Solscan before retrying because the deposit may have actually landed
 */

const shieldRequestSchema = z.object({
  amountUsdc: z.number().positive().finite(),
});

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return apiError("UNAUTHORIZED", "Missing Authorization header");
  }

  let identity;
  try {
    identity = await verifyPrivyTokenAndGetIdentifiers(token);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Request body must be valid JSON");
  }

  const parsed = shieldRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "Invalid request body", {
      logFields: { issues: parsed.error.issues },
    });
  }

  const { amountUsdc } = parsed.data;

  let amountBaseUnits: bigint;
  try {
    amountBaseUnits = BigInt(usdcToBaseUnits(amountUsdc).toString());
  } catch (err) {
    return apiError("VALIDATION_FAILED", "Invalid USDC amount", {
      logFields: { amountUsdc, err: String(err) },
    });
  }

  // ── Resolve sender wallet ────────────────────────────────────────────────
  let wallet;
  try {
    wallet = await ensureSenderWallet(identity.privyUserId, {
      email: identity.email,
      phone: identity.phone,
    });
  } catch (err) {
    return apiError("UPSTREAM_ERROR", "Failed to resolve wallet", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }

  // ── Pre-flight gas check ─────────────────────────────────────────────────
  // Avoids a confusing "Transaction simulation failed" error for the common
  // case of "user has USDC but no SOL." We surface a clear actionable error.
  try {
    const gasError = await checkGasSufficient(wallet.solanaAddress);
    if (gasError) {
      return apiError("BAD_REQUEST", gasError.message, {
        logFields: {
          gasError: true,
          solDisplay: gasError.solDisplay,
        },
      });
    }
  } catch (err) {
    // Don't block on gas-check failures — log and let the SDK try.
    // Better to attempt and fail with the SDK's error than to falsely block.
    log.warn("Gas check failed, proceeding anyway", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Shield ───────────────────────────────────────────────────────────────
  let result;
  try {
    result = await shieldUsdc({
      walletId: wallet.walletId,
      walletAddress: wallet.solanaAddress,
      amountBaseUnits,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stage = (err as { stage?: string } | null)?.stage;
    log.error("Shield failed", {
      address: wallet.solanaAddress,
      stage,
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return apiError("UPSTREAM_ERROR", "Shield (deposit) failed", {
      logFields: { stage, message },
    });
  }

  return Response.json({
    ok: true,
    queueSignature: result.queueSignature,
    callbackSignature: result.callbackSignature,
    callbackElapsedMs: result.callbackElapsedMs,
    rentClaimError: result.rentClaimError,
  });
}