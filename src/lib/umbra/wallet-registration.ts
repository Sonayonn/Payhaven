import "server-only";
import {
  getUserRegistrationFunction,
  getUserAccountQuerierFunction,
} from "@umbra-privacy/sdk";
import { getUserRegistrationProver } from "@umbra-privacy/web-zk-prover";
import {
  address as toAddress,
  createKeyPairSignerFromBytes,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import bs58 from "bs58";
import { getPrivyUmbraClient } from "./privy-umbra-client";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

// Per CONVENTIONS.md:
//   §4 , registration is a one-way door; never re-run on an already-
//         registered keypair. Our retry is safe because each call is
//         idempotent at the step level, guarded by on-chain queries.
//   §13, Umbra SDK stage labels are misleading; don't use return values
//         as ground truth. Use getUserAccountQuerierFunction to check
//         actual on-chain state.
//   §16, register() returning signatures:[] means "nothing submitted
//         THIS CALL," NOT "fully registered." Confirmed by Umbra team
//         on Day 8 Discord.
//
// This module's entire strategy: query the chain for truth, retry up to
// MAX_ATTEMPTS, and only declare success when both X25519 and commitment
// flags are true on-chain.

const REGISTRATION_SOL_LAMPORTS = 15_000_000n; // 0.015 SOL top-up
const FUNDING_FLOOR_LAMPORTS = 1_000_000n; // 0.01 SOL floor
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

export type RegisterWalletResult = {
  alreadyRegistered: boolean;
  signatures: string[];
};

// Inlined account-state shape, the SDK's inferred type nests too deep
// for TS to unwrap cleanly, so we declare the fields we rely on and
// `as QueryResult`-cast the query results. Matches the docs at
// https://sdk.umbraprivacy.com/sdk/account-state, extra fields on the
// actual result are ignored, which is fine.
type QueryResult =
  | { state: "non_existent" }
  | {
      state: "exists";
      data: {
        isInitialised: boolean;
        isUserAccountX25519KeyRegistered: boolean;
        isUserCommitmentRegistered: boolean;
        isActiveForAnonymousUsage: boolean;
      };
    };

/**
 * Register a Privy-owned wallet with Umbra for both confidential and
 * anonymous modes. Works identically for sender and recipient wallets.
 *
 * Correctness strategy (lessons from Day 8):
 *   1. Query on-chain state FIRST, if both X25519 and commitment flags
 *      are already true, skip everything. Zero cost for repeat calls.
 *   2. If registration is incomplete, fund the wallet (idempotent —
 *      skipped if already above floor) then call register() once with
 *      both flags. The SDK sequences the 3 steps internally and is
 *      documented idempotent, so any steps already done are skipped.
 *   3. After each attempt, re-query on-chain. If the state flags are
 *      both true, done. If not, pause and try again, handles the
 *      mainnet confirmation-timeout case where step N landed but step
 *      N+1's confirmation wait fired prematurely.
 *   4. Give up with a real error if MAX_ATTEMPTS still leaves gaps.
 *      Exposes the bug rather than hiding it under a stale "registered"
 *      flag in Supabase.
 */
export async function registerWalletIfNeeded(params: {
  walletId: string;
  address: string;
}): Promise<RegisterWalletResult> {
  const walletAddr = toAddress(params.address);
  const client = await getPrivyUmbraClient({
    walletId: params.walletId,
    address: params.address,
  });

  const query = getUserAccountQuerierFunction({ client });

  // ── Ground-truth check ───────────────────────────────────────────────
  const initialState = (await query(walletAddr)) as QueryResult;

  if (isFullyRegistered(initialState)) {
    log.info("Wallet fully registered on-chain, skipping", {
      address: params.address,
      isActiveForAnonymousUsage:
        initialState.state === "exists"
          ? initialState.data.isActiveForAnonymousUsage
          : false,
    });
    return { alreadyRegistered: true, signatures: [] };
  }

  log.info("Registration state before attempt", {
    address: params.address,
    ...describeState(initialState),
  });

  // ── Fund the wallet ──────────────────────────────────────────────────
  await fundWalletIfBelowFloor(walletAddr, REGISTRATION_SOL_LAMPORTS);

  // ── Attempt loop ─────────────────────────────────────────────────────
  const zkProver = getUserRegistrationProver();
  const register = getUserRegistrationFunction({ client }, { zkProver });

  const allSignatures: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const sigs = await register({
        confidential: true,
        anonymous: true,
      });
      allSignatures.push(...(sigs as unknown as string[]));

      log.info("Register call completed", {
        attempt,
        address: params.address,
        newSigs: sigs.length,
      });
    } catch (err) {
      const stage = (err as { stage?: string } | null)?.stage;
      const signature = (err as { signature?: string } | null)?.signature;

      log.warn("Register call threw mid-flight", {
        attempt,
        address: params.address,
        stage,
        signature,
        willVerify: true,
      });

      // Only transaction-send / transaction-validate are expected retryable
      // failures. Anything else is a real bug, throw so we see it.
      if (stage !== "transaction-send" && stage !== "transaction-validate") {
        throw err;
      }

      // Brief pause for chain propagation so the next query sees any
      // state that did land before the timeout fired.
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    // ── Verify on-chain state ──────────────────────────────────────────
    const state = (await query(walletAddr)) as QueryResult;

    if (isFullyRegistered(state)) {
      log.info("Wallet fully registered after attempt", {
        attempt,
        address: params.address,
        totalSigsThisSession: allSignatures.length,
      });
      return { alreadyRegistered: false, signatures: allSignatures };
    }

    log.warn("Registration still incomplete after attempt", {
      attempt,
      address: params.address,
      remaining: describeState(state),
      willRetry: attempt < MAX_ATTEMPTS,
    });

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  // ── All attempts exhausted, still incomplete ─────────────────────────
  const finalState = (await query(walletAddr)) as QueryResult;
  throw new Error(
    `Registration incomplete after ${MAX_ATTEMPTS} attempts for ${
      params.address
    }. Final state: ${JSON.stringify(describeState(finalState))}`,
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function isFullyRegistered(result: QueryResult): boolean {
  return (
    result.state === "exists" &&
    result.data.isUserAccountX25519KeyRegistered &&
    result.data.isUserCommitmentRegistered
  );
}

function describeState(result: QueryResult): Record<string, unknown> {
  if (result.state === "non_existent") {
    return { state: "non_existent" };
  }
  return {
    state: result.state,
    isInitialised: result.data.isInitialised,
    x25519Registered: result.data.isUserAccountX25519KeyRegistered,
    commitmentRegistered: result.data.isUserCommitmentRegistered,
    isActiveForAnonymousUsage: result.data.isActiveForAnonymousUsage,
  };
}

/**
 * Fund any Solana address from treasury if its balance is below the
 * floor. Used for registration gas and UTXO-creation rent headroom.
 *
 * Treasury's only on-chain role in Option B: gas sponsor for new
 * wallets. Never touches USDC, that lives in the user's wallet.
 */
async function fundWalletIfBelowFloor(
  target: ReturnType<typeof toAddress>,
  lamports: bigint,
): Promise<void> {
  const rpc = createSolanaRpc(env.SOLANA_RPC_URL);
  const rpcSubscriptions = createSolanaRpcSubscriptions(env.SOLANA_WS_URL);

  const { value: balanceLamports } = await rpc.getBalance(target).send();

  if (balanceLamports >= FUNDING_FLOOR_LAMPORTS) {
    log.info("Wallet already funded, skipping transfer", {
      address: target,
      balanceLamports: balanceLamports.toString(),
    });
    return;
  }

  log.info("Funding wallet for registration gas", {
    address: target,
    currentBalance: balanceLamports.toString(),
    transferAmount: lamports.toString(),
  });

  const treasuryKeyBytes = bs58.decode(env.TREASURY_SECRET_KEY_B58);
  const treasurySigner = await createKeyPairSignerFromBytes(treasuryKeyBytes);

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transferIx = getTransferSolInstruction({
    source: treasurySigner,
    destination: target,
    amount: lamports,
  });

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(treasurySigner, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(transferIx, m),
  );

  const signedTx = await signTransactionMessageWithSigners(txMessage);

  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });

  await sendAndConfirm(
    signedTx as Parameters<typeof sendAndConfirm>[0],
    { commitment: "confirmed" },
  );

  log.info("Wallet funded", { address: target });
}
export { fundWalletIfBelowFloor };