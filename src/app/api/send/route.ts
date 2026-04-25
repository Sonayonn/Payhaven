import { NextRequest } from "next/server";
import { z } from "zod";
import { address } from "@solana/kit";
import { getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction } from "@umbra-privacy/sdk";
import { getCreateReceiverClaimableUtxoFromEncryptedBalanceProver } from "@umbra-privacy/web-zk-prover";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { usdcToBaseUnits } from "@/lib/money";
import { USDC_MAINNET_MINT } from "@/lib/umbra/constants";
import { getPrivyUmbraClient } from "@/lib/umbra/privy-umbra-client";
import { registerWalletIfNeeded } from "@/lib/umbra/wallet-registration";
import { verifyPrivyToken } from "@/lib/privy/server";
import { ensureSenderWallet } from "@/lib/privy/sender-wallet";
import { getEncryptedUsdcBalance } from "@/lib/umbra/encrypted-balance";
import {
  pregenerateRecipientWallet,
  normalizeIdentifier,
  type PregenResult,
} from "@/lib/privy/pregen";
import { createClaimToken } from "@/lib/claim-tokens/server";
import { env } from "@/lib/env";
import type { U64 } from "@umbra-privacy/sdk/types";

// ── Request validation ─────────────────────────────────────────────────────

const sendRequestSchema = z.object({
  recipient: z.object({
    kind: z.enum(["email", "phone"]),
    value: z.string().min(3),
  }),
  amountUsdc: z.number().positive().finite(),
});

// ── Handler ────────────────────────────────────────────────────────────────

/**
 * POST /api/send — sender-originated private USDC transfer.
 *
 * Privacy model (post-Step-3 upgrade):
 *   USDC moves from sender's encrypted balance → Umbra shielded pool →
 *   recipient's encrypted UTXO. The sender's public ATA does not change.
 *   On-chain footprint: "sender wallet interacted with Umbra program."
 *   Amount, destination, recipient all encrypted.
 *
 * Sender must have shielded their balance first (via /api/shield) so that
 * encrypted balance >= amount. Public ATA balance is not consulted here.
 */
export async function POST(req: NextRequest) {
  // ── Verify Privy access token ────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return apiError("UNAUTHORIZED", "Missing Authorization header");
  }

  let senderPrivyUserId: string;
  try {
    senderPrivyUserId = await verifyPrivyToken(token);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  // ── Parse + validate body ────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Request body must be valid JSON");
  }

  const parsed = sendRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "Invalid request body", {
      logFields: { issues: parsed.error.issues },
    });
  }

  const { recipient: rawRecipient, amountUsdc } = parsed.data;

  // Normalize the recipient identifier at the edge so dedup lookups, logs,
  // and claim_tokens.recipient_identifier persistence all share one canonical
  // form. Emails lowercase+trim, phones collapse to E.164. Non-E.164 phone
  // input rejected with a user-visible error.
  let recipient: { kind: "email" | "phone"; value: string };
  try {
    recipient = {
      kind: rawRecipient.kind,
      value: normalizeIdentifier(rawRecipient.value, rawRecipient.kind),
    };
  } catch (err) {
    return apiError("VALIDATION_FAILED", "Invalid recipient identifier", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }

  let amountBaseUnits: U64;
  try {
    amountBaseUnits = usdcToBaseUnits(amountUsdc) as unknown as U64;
  } catch (err) {
    return apiError("VALIDATION_FAILED", "Invalid USDC amount", {
      logFields: { amountUsdc, err: String(err) },
    });
  }

  log.info("Send request accepted", {
    senderPrivyUserId,
    recipientKind: recipient.kind,
    amountBaseUnits: amountBaseUnits.toString(),
  });

  // ── Resolve sender's Payhaven wallet ─────────────────────────────────────
  let senderWallet;
  try {
    senderWallet = await ensureSenderWallet(senderPrivyUserId);
  } catch (err) {
    return apiError("UPSTREAM_ERROR", "Failed to resolve sender wallet", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }

  log.info("Sender wallet resolved", {
    senderPrivyUserId,
    senderAddress: senderWallet.solanaAddress,
  });

  // ── Precheck: does sender have enough in encrypted balance? ──────────────
  // UX gate: surface a clear error code if the user hasn't shielded enough.
  // The encrypted-balance UTXO creator would fail at SDK level otherwise,
  // but the error message would be opaque. INSUFFICIENT_PRIVATE_BALANCE
  // tells the frontend to prompt "shield more first".
  const amountBaseBigInt = BigInt(amountBaseUnits.toString());
  let senderEncryptedBalance;
  try {
    senderEncryptedBalance = await getEncryptedUsdcBalance({
      walletId: senderWallet.walletId,
      address: senderWallet.solanaAddress,
    });
  } catch (err) {
    return apiError("UPSTREAM_ERROR", "Failed to read sender encrypted balance", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }

  if (
    senderEncryptedBalance.state !== "shared" ||
    senderEncryptedBalance.balanceBaseUnits < amountBaseBigInt
  ) {
    log.warn("Insufficient encrypted balance for send", {
      senderAddress: senderWallet.solanaAddress,
      requested: amountBaseBigInt.toString(),
      available: senderEncryptedBalance.balanceBaseUnits.toString(),
      state: senderEncryptedBalance.state,
    });
    return apiError(
      "BAD_REQUEST",
      "Not enough in your private balance. Shield more USDC first.",
      {
        logFields: {
          requested: amountBaseBigInt.toString(),
          available: senderEncryptedBalance.balanceBaseUnits.toString(),
        },
      },
    );
  }

  // ── Pregenerate (or reuse) recipient wallet ──────────────────────────────
  let pregen: PregenResult;
  try {
    pregen = await pregenerateRecipientWallet(recipient.value, recipient.kind);
  } catch (err) {
    return apiError("UPSTREAM_ERROR", "Failed to pregenerate recipient wallet", {
      logFields: { err: err instanceof Error ? err.message : String(err) },
    });
  }
  const recipientAddress = pregen.solanaAddress;
  const recipientWalletId = pregen.walletId;

  // ── Pre-register recipient with Umbra ────────────────────────────────────
  // Receiver-claimable UTXOs require an on-chain X25519 key for the recipient.
  // Skipped on repeat sends (previouslyRegistered=true).
  if (!pregen.previouslyRegistered) {
    try {
      const { alreadyRegistered, signatures } = await registerWalletIfNeeded({
        walletId: recipientWalletId,
        address: recipientAddress,
      });
      log.info("Recipient registration checked", {
        recipientAddress,
        alreadyRegistered,
        registrationTxCount: signatures.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stage = (err as { stage?: string } | null)?.stage;
      return apiError(
        "UPSTREAM_ERROR",
        "Failed to register recipient with Umbra",
        { logFields: { message, stage, recipientAddress } },
      );
    }
  } else {
    log.info("Recipient previously registered — skipping registration", {
      recipientAddress,
    });
  }

  // ── Create UTXO via Umbra — from sender's ENCRYPTED balance ──────────────
  // Core privacy guarantee in its strongest form. Sender's public ATA balance
  // does not change. On-chain footprint: just "sender interacted with Umbra."
  // Amount, destination, recipient all hidden.
  let queueSignature: string;
  let callbackSignature: string | undefined;
  let callbackElapsedMs: number | undefined;
  try {
    const senderClient = await getPrivyUmbraClient({
      walletId: senderWallet.walletId,
      address: senderWallet.solanaAddress,
    });
    const zkProver = getCreateReceiverClaimableUtxoFromEncryptedBalanceProver();
    const createUtxo = getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction(
      { client: senderClient },
      { zkProver },
    );

    const result = await createUtxo({
      destinationAddress: address(recipientAddress),
      mint: address(USDC_MAINNET_MINT),
      amount: amountBaseUnits,
    });

    // CreateUtxoFromEncryptedBalanceResult shape per SDK types:
    //   queueSignature: TransactionSignature (required)
    //   callbackSignature?: TransactionSignature (when MPC completes in time)
    //   callbackElapsedMs?: number
    //   plus rent-related signatures we don't surface
    const raw = result as unknown as Record<string, unknown>;
    queueSignature = String(raw.queueSignature ?? "");
    callbackSignature =
      typeof raw.callbackSignature === "string"
        ? raw.callbackSignature
        : undefined;
    callbackElapsedMs =
      typeof raw.callbackElapsedMs === "number"
        ? raw.callbackElapsedMs
        : undefined;

    log.info("UTXO created from encrypted balance", {
      queueSignature,
      callbackSignature,
      callbackElapsedMs,
      senderAddress: senderWallet.solanaAddress,
      recipientAddress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stage = (err as { stage?: string } | null)?.stage;
    log.error("Encrypted-balance UTXO creation failed", {
      stage,
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return apiError("UPSTREAM_ERROR", "Send failed", {
      logFields: { message, stage },
    });
  }

  // ── Create claim token ───────────────────────────────────────────────────
  // Use queueSignature as the createUtxoSignature for compatibility with the
  // existing claim_tokens schema and downstream claim flow. The callback
  // signature is also relevant on-chain but doesn't need to be persisted.
  let claimToken;
  try {
    claimToken = await createClaimToken({
      recipientIdentifier: recipient.value,
      recipientAddress,
      recipientWalletId,
      amountUsdcBaseUnits: amountBaseBigInt,
      createUtxoSignature: queueSignature,
      senderPrivyUserId,
      umbraRegisteredAt: new Date(),
    });
  } catch (err) {
    log.error("Claim token creation failed — UTXO is orphaned", {
      err: err instanceof Error ? err.message : String(err),
      queueSignature,
    });
    return apiError("INTERNAL_ERROR", "Claim token persistence failed");
  }

  // ── Build claim URL for the sender to share ──────────────────────────────
  const appBaseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const claimUrl = `${appBaseUrl}/claim/${claimToken.token}`;

  return Response.json({
    ok: true,
    claimToken: claimToken.token,
    claimUrl,
    expiresAt: claimToken.expiresAt,
    createUtxoSignature: queueSignature,
    callbackSignature,
    callbackElapsedMs,
  });
}