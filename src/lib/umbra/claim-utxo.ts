import "server-only";
import {
  getClaimableUtxoScannerFunction,
  getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction,
  getUmbraRelayer,
  getBatchMerkleProofFetcher,
} from "@umbra-privacy/sdk";
import type { U32 } from "@umbra-privacy/sdk/types";
import { getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver } from "@umbra-privacy/web-zk-prover";
import { getPrivyUmbraClient } from "./privy-umbra-client";
import { UMBRA_RELAYER, UMBRA_INDEXER } from "./constants";
import { log } from "@/lib/log";

/**
 * Claim a receiver-claimable UTXO into the recipient's encrypted balance.
 *
 * STRICT CONTRACT: this function either
 *   (a) returns with a non-empty claimSignatures array (claim landed on-chain), OR
 *   (b) throws.
 *
 * It will NEVER return success with empty signatures. The caller can trust
 * that a successful return means the claim is real and on-chain.
 *
 * Per CONVENTIONS.md:
 *   §13 — transaction-send errors can mean "landed but timed out." Caller
 *         must verify on-chain before retrying.
 *
 * MEMORY NOTE: each UTXO requires ZK proof generation, which is memory-intensive.
 * Vercel Hobby (1024MB) is blown by ~3 UTXOs per invocation. We claim ONE UTXO
 * per request, oldest first (FIFO). If multiple are queued, caller calls again.
 */

export type ClaimUtxoResult = {
  claimSignatures: string[];
  matchedInsertionIndex: number;
  remainingUtxoCount: number;
};

const MAX_STALE_PROOF_RETRIES = 1;

export async function claimReceiverUtxo(params: {
  recipientWalletId: string;
  recipientAddress: string;
  createUtxoSignature: string;
  treeIndex?: number;
}): Promise<ClaimUtxoResult> {
  const client = await getPrivyUmbraClient({
    walletId: params.recipientWalletId,
    address: params.recipientAddress,
  });

  const treeIndex = params.treeIndex ?? 0;

  for (let attempt = 0; attempt <= MAX_STALE_PROOF_RETRIES; attempt++) {
    // ── Step 1: Scan the tree for UTXOs addressed to this recipient ─────────
    const scan = getClaimableUtxoScannerFunction({ client });

    log.info("Scanning for claimable UTXOs", {
      recipientAddress: params.recipientAddress,
      treeIndex,
      attempt,
    });

    let scanResult;
    try {
      // Per current docs: branded U32, not bigint. Cast TypeScript-only.
      scanResult = await scan(
      BigInt(treeIndex) as unknown as U32,
      0n as unknown as U32,
      );
    } catch (scanErr) {
      log.error("Scanner threw", {
        recipientAddress: params.recipientAddress,
        message: scanErr instanceof Error ? scanErr.message : String(scanErr),
        stack: scanErr instanceof Error ? scanErr.stack : undefined,
        stage: (scanErr as { stage?: string } | null)?.stage,
      });
      throw scanErr;
    }

    const encryptedReceived = scanResult.received ?? [];
    const publicReceived = scanResult.publicReceived ?? [];
    const allReceiverUtxos = [...encryptedReceived, ...publicReceived];

    log.info("Scan complete", {
      recipientAddress: params.recipientAddress,
      received: encryptedReceived.length,
      publicReceived: publicReceived.length,
      selfBurnable: scanResult.selfBurnable?.length ?? 0,
      publicSelfBurnable: scanResult.publicSelfBurnable?.length ?? 0,
    });

    if (allReceiverUtxos.length === 0) {
      throw new Error(
        "No claimable UTXOs found for this recipient. The UTXO may not yet be indexed " +
          "(can take 5-30s after creation), or it may have already been claimed.",
      );
    }

    // LIFO: claim newest first. Older UTXOs may have already-burnt nullifiers
    // (from prior claim attempts that landed on-chain but appeared to fail
    // client-side due to the silent-failure bug). Newer UTXOs are real money
    // most likely to succeed. The SDK scanner doesn't check nullifier status,
    // so it returns burnt UTXOs alongside live ones — pick the freshest.
    const receiverUtxos = [allReceiverUtxos[allReceiverUtxos.length - 1]!];
    const remainingUtxoCount = allReceiverUtxos.length - 1;

    log.info("Selecting single UTXO from claimable bucket (LIFO, newest first)", {
      recipientAddress: params.recipientAddress,
      totalAvailable: allReceiverUtxos.length,
      remainingAfterThisClaim: remainingUtxoCount,
    });

    // ── Step 2: Set up claim deps ───────────────────────────────────────────
    // CONVENTIONS §1 drift #2: docs say {zkProver, relayer}, but installed
    // SDK requires fetchBatchMerkleProof as a third dep. .d.ts is truth.
    const zkProver = getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver();
    const relayer = getUmbraRelayer({ apiEndpoint: UMBRA_RELAYER });
    const fetchBatchMerkleProof = getBatchMerkleProofFetcher({
      apiEndpoint: UMBRA_INDEXER,
    });

    const claim = getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction(
      { client },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { zkProver, relayer, fetchBatchMerkleProof } as any,
    );

    log.info("Submitting claim via Umbra relayer", {
      recipientAddress: params.recipientAddress,
      utxoCount: receiverUtxos.length,
    });

    let result: unknown;
    try {
      result = await claim(receiverUtxos);
    } catch (err) {
      const stage = (err as { stage?: string } | null)?.stage;

      log.error("Claim threw — full diagnostic", {
        recipientAddress: params.recipientAddress,
        stage,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });

      // Stale proof — re-scan and retry once
      if (stage === "transaction-validate" && attempt < MAX_STALE_PROOF_RETRIES) {
        log.warn("Claim failed with stale Merkle proof — rescanning and retrying", {
          recipientAddress: params.recipientAddress,
          stage,
        });
        continue;
      }

      throw err;
    }

    // ── Step 3: Extract signatures and ENFORCE the strict contract ──────────
    log.info("Claim result shape", {
      keys:
        result && typeof result === "object"
          ? Object.keys(result as object)
          : [],
      type: typeof result,
      isArray: Array.isArray(result),
      stringified: JSON.stringify(result, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ).slice(0, 1500),
    });

    const claimSignatures = extractClaimSignatures(result);

    if (claimSignatures.length === 0) {
      // The SDK returned without throwing but produced no signatures.
      // Per current Umbra behavior, this happens when the relayer rejects
      // submission silently (e.g., nullifier already burnt, or submission
      // declined for another reason).
      //
      // We must NOT report success. Throw so the caller knows nothing landed.
      throw new ClaimNotSubmittedError(
        "Umbra returned no transaction signatures. The claim was not submitted on-chain. " +
          "This usually means the UTXO was already claimed (nullifier burnt), " +
          "or the relayer rejected the submission.",
        result,
      );
    }

    // Defensive: extract insertion index for logging
    let matchedInsertionIndex = 0;
    const firstUtxo = receiverUtxos[0] as unknown as {
      insertionIndex?: number | bigint;
    };
    if (firstUtxo.insertionIndex !== undefined) {
      matchedInsertionIndex = Number(firstUtxo.insertionIndex);
    }

    log.info("Claim submitted successfully", {
      recipientAddress: params.recipientAddress,
      claimSignatures,
      remainingUtxoCount,
    });

    return { claimSignatures, matchedInsertionIndex, remainingUtxoCount };
  }

  throw new Error("Claim retries exhausted");
}

/**
 * Thrown when the SDK returns without error but produces no transaction
 * signatures. Distinct from a normal SDK error because there's no stack
 * frame inside the SDK to blame — the SDK simply returned an empty result.
 */
export class ClaimNotSubmittedError extends Error {
  constructor(
    message: string,
    public sdkResult: unknown,
  ) {
    super(message);
    this.name = "ClaimNotSubmittedError";
  }
}

/**
 * Extract transaction signatures from the SDK's claim result.
 * Handles all known shapes; returns empty array if nothing matched.
 */
function extractClaimSignatures(result: unknown): string[] {
  const claimSignatures: string[] = [];

  if (!result || typeof result !== "object") return claimSignatures;

  const candidate = result as Record<string, unknown>;

  // Shape 1: { signatures: Record<string|number, string[] | string> }
  if (candidate.signatures && typeof candidate.signatures === "object") {
    for (const sigs of Object.values(
      candidate.signatures as Record<string, unknown>,
    )) {
      const arr = Array.isArray(sigs) ? sigs : [sigs];
      for (const sig of arr) {
        if (typeof sig === "string" && sig.length > 0) {
          claimSignatures.push(sig);
        }
      }
    }
  }

  // Shape 2: { batches: Map | Record of { txSignature?: string } }
  if (claimSignatures.length === 0 && candidate.batches) {
    const batchesIterable =
      candidate.batches instanceof Map
        ? candidate.batches.values()
        : Object.values(candidate.batches as Record<string, unknown>);
    for (const batch of batchesIterable) {
      const b = batch as { txSignature?: string };
      if (b.txSignature && typeof b.txSignature === "string") {
        claimSignatures.push(b.txSignature);
      }
    }
  }

  // Shape 3: direct array of signatures
  if (claimSignatures.length === 0 && Array.isArray(result)) {
    for (const item of result as unknown[]) {
      if (typeof item === "string" && item.length > 0) {
        claimSignatures.push(item);
      }
    }
  }

  // Shape 4: singleton sig fields
  if (claimSignatures.length === 0) {
    for (const key of ["transactionSignature", "txSignature", "signature"]) {
      const val = candidate[key];
      if (typeof val === "string" && val.length > 0) {
        claimSignatures.push(val);
        break;
      }
    }
  }

  return claimSignatures;
}