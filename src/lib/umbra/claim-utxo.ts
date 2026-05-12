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
 * It will NEVER return success with empty signatures.
 *
 * STRATEGY:
 * - Pick newest UTXO (LIFO).
 * - If the SDK returns empty signatures (the Umbra indexer can show a
 *   burnt nullifier as still-claimable for a few minutes after a successful
 *   claim), fall back to the second-newest UTXO once.
 * - If both newest and second-newest return empty, throw with guidance.
 *
 * Max 2 ZK proof attempts per call — memory and time bounded.
 * For queues larger than 2, the caller (frontend drainQueue loop) calls
 * this function again, which re-scans, picks a new newest, and proceeds.
 *
 * Per CONVENTIONS.md:
 *   §13 — transaction-send errors can mean "landed but timed out." Caller
 *         must verify on-chain before retrying.
 */

export type ClaimUtxoResult = {
  claimSignatures: string[];
  matchedInsertionIndex: number;
  remainingUtxoCount: number;
};

const MAX_STALE_PROOF_RETRIES = 1;
// Max UTXOs we'll attempt per call. Bounds time + memory. The frontend
// drainQueue loop handles queues larger than this by calling repeatedly.
const MAX_LIFO_FALLBACK_ATTEMPTS = 2;

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

    // ── Step 2: Set up claim deps once for all attempts ─────────────────────
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

    // ── Step 3: LIFO with single fallback ──────────────────────────────────
    // Try newest first. If empty signatures (indexer lag → burnt nullifier
    // showing as still-claimable), try second-newest once.
    const utxoCount = allReceiverUtxos.length;
    const fallbackBudget = Math.min(utxoCount, MAX_LIFO_FALLBACK_ATTEMPTS);
    let staleProofRecurse = false;

    for (let i = 0; i < fallbackBudget; i++) {
      const utxoIndex = utxoCount - 1 - i;
      const candidateUtxo = allReceiverUtxos[utxoIndex]!;

      log.info("Attempting claim on UTXO (LIFO)", {
        recipientAddress: params.recipientAddress,
        utxoIndex,
        attemptNumber: i + 1,
        fallbackBudget,
        totalInQueue: utxoCount,
      });

      let result: unknown;
      try {
        result = await claim([candidateUtxo]);
      } catch (err) {
        const stage = (err as { stage?: string } | null)?.stage;

        log.error("Claim threw on this UTXO", {
          recipientAddress: params.recipientAddress,
          utxoIndex,
          stage,
          message: err instanceof Error ? err.message : String(err),
        });

        // Stale Merkle proof — break out, outer loop re-scans the tree
        if (stage === "transaction-validate" && attempt < MAX_STALE_PROOF_RETRIES) {
          log.warn("Stale proof, rescanning queue", {
            recipientAddress: params.recipientAddress,
          });
          staleProofRecurse = true;
          break;
        }

        // Other SDK errors — propagate immediately. These are real issues
        // (auth, network, prover crashes), not indexer-lag candidates.
        throw err;
      }

      log.info("Claim result shape", {
        recipientAddress: params.recipientAddress,
        utxoIndex,
        keys:
          result && typeof result === "object"
            ? Object.keys(result as object)
            : [],
        stringified: JSON.stringify(result, (_k, v) =>
          typeof v === "bigint" ? v.toString() : v,
        ).slice(0, 500),
      });

      const claimSignatures = extractClaimSignatures(result);

      if (claimSignatures.length > 0) {
        // ── Success ──
        let matchedInsertionIndex = 0;
        const utxoMeta = candidateUtxo as unknown as {
          insertionIndex?: number | bigint;
        };
        if (utxoMeta.insertionIndex !== undefined) {
          matchedInsertionIndex = Number(utxoMeta.insertionIndex);
        }

        log.info("Claim submitted successfully", {
          recipientAddress: params.recipientAddress,
          utxoIndex,
          claimSignatures,
          attemptsUsed: i + 1,
        });

        return {
          claimSignatures,
          matchedInsertionIndex,
          remainingUtxoCount: Math.max(0, utxoCount - 1),
        };
      }

      // Empty signatures — newest UTXO likely burnt nullifier (indexer lag).
      // If we have budget left, try second-newest.
      if (i + 1 < fallbackBudget) {
        log.warn("Newest UTXO returned empty (likely indexer lag), trying second-newest", {
          recipientAddress: params.recipientAddress,
          utxoIndex,
        });
        continue;
      }
    }

    if (staleProofRecurse) {
      continue;
    }

    // Both newest and second-newest returned empty.
    throw new ClaimNotSubmittedError(
      `Tried ${fallbackBudget} of ${utxoCount} UTXOs (newest first). None returned signatures. ` +
        `This usually means the indexer is briefly showing already-claimed UTXOs as still ` +
        `claimable, which resolves in a few minutes. Try again shortly.`,
      null,
    );
  }

  throw new Error("Claim retries exhausted");
}

export class ClaimNotSubmittedError extends Error {
  constructor(
    message: string,
    public sdkResult: unknown,
  ) {
    super(message);
    this.name = "ClaimNotSubmittedError";
  }
}

function extractClaimSignatures(result: unknown): string[] {
  const claimSignatures: string[] = [];

  if (!result || typeof result !== "object") return claimSignatures;

  const candidate = result as Record<string, unknown>;

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

  if (claimSignatures.length === 0 && Array.isArray(result)) {
    for (const item of result as unknown[]) {
      if (typeof item === "string" && item.length > 0) {
        claimSignatures.push(item);
      }
    }
  }

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