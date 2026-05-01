import { NextRequest } from "next/server";
import { z } from "zod";
import { createNoopSigner } from "@solana/kit";
import {
  address,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  compileTransaction,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
} from "@solana/kit";
import {
  findAssociatedTokenPda,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
  getCreateAssociatedTokenIdempotentInstruction,
} from "@solana-program/token";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { env } from "@/lib/env";
import { verifyPrivyTokenAndGetIdentifiers } from "@/lib/privy/server";
import { ensureSenderWallet } from "@/lib/privy/sender-wallet";
import { createPrivySigner } from "@/lib/umbra/privy-signer";
import { USDC_MAINNET_MINT } from "@/lib/umbra/constants";

const requestSchema = z.object({
  destinationAddress: z.string().min(32).max(44),
  amountUsdc: z.number().positive().max(1_000_000),
});

/**
 * POST /api/withdraw

 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return apiError("UNAUTHORIZED", "Missing Authorization header");

  let identity;
  try {
    identity = await verifyPrivyTokenAndGetIdentifiers(token);
  } catch {
    return apiError("UNAUTHORIZED", "Invalid or expired token");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Request body must be valid JSON");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "Invalid request body", {
      logFields: { issues: parsed.error.issues },
    });
  }

  const { destinationAddress, amountUsdc } = parsed.data;

  let destination;
  try {
    destination = address(destinationAddress);
  } catch {
    return apiError(
      "VALIDATION_FAILED",
      "Destination is not a valid Solana address",
    );
  }

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

  const amountBaseUnits = BigInt(Math.round(amountUsdc * 1_000_000));

  log.info("Withdraw initiated", {
    privyUserId: identity.privyUserId,
    fromAddress: wallet.solanaAddress,
    destinationAddress,
    amountUsdc,
    amountBaseUnits: amountBaseUnits.toString(),
  });

  try {
    const rpc = createSolanaRpc(env.SOLANA_RPC_URL);
    const rpcSubscriptions = createSolanaRpcSubscriptions(env.SOLANA_WS_URL);

    const fromAddr = address(wallet.solanaAddress);
    const usdcMint = address(USDC_MAINNET_MINT);

    const [fromAtaResult, destAtaResult] = await Promise.all([
      findAssociatedTokenPda({
        owner: fromAddr,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint: usdcMint,
      }),
      findAssociatedTokenPda({
        owner: destination,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint: usdcMint,
      }),
    ]);
    const [fromAta] = fromAtaResult;
    const [destAta] = destAtaResult;

    const signer = createPrivySigner({
      walletId: wallet.walletId,
      address: wallet.solanaAddress,
    });

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
      payer: createNoopSigner(fromAddr),
      owner: destination,
      mint: usdcMint,
      ata: destAta,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      systemProgram: address("11111111111111111111111111111111"),
    });

    const transferIx = getTransferCheckedInstruction({
      source: fromAta,
      mint: usdcMint,
      destination: destAta,
      authority: fromAddr,
      amount: amountBaseUnits,
      decimals: 6,
    });

    // Build the unsigned message + compile to a transaction. fromAddr is the
    // fee payer (set as plain Address, not a Signer, we'll add the signature
    // manually via Privy below).
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayer(fromAddr, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      (m) => appendTransactionMessageInstruction(createAtaIx, m),
      (m) => appendTransactionMessageInstruction(transferIx, m),
    );

    const unsignedTx = compileTransaction(message);

    // Hand off to PrivySigner.signTransaction, which serializes via kit's
    // encoder, signs via Privy's wallet API, and merges the signature back
    // into the kit transaction shape.
    const signedTx = await signer.signTransaction(unsignedTx);

    const signature = getSignatureFromTransaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signedTx as any,
    );

    const sendAndConfirm = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions,
    });

    await sendAndConfirm(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signedTx as any,
      { commitment: "confirmed" },
    );

    log.info("Withdraw confirmed", {
      privyUserId: identity.privyUserId,
      signature,
      destinationAddress,
      amountUsdc,
    });

    return Response.json({
      ok: true,
      signature,
      destinationAddress,
      amountUsdc,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Withdraw failed", {
      privyUserId: identity.privyUserId,
      destinationAddress,
      amountUsdc,
      err: message,
    });
    return apiError("UPSTREAM_ERROR", "Withdraw failed: " + message);
  }
}