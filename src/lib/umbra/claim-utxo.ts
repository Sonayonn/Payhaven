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
 * Per CONVENTIONS.md:
 *   §1 drift #2 — docs say claimer deps are {zkProver, relayer}; real SDK also needs
 *                 fetchBatchMerkleProof from getBatchMerkleProofFetcher.
 *   §1 drift #4 — docs examples use ClaimableUtxoData[]; real function takes whatever
 *                 the scanner returns. Pass scan result directly without transformation.
 *   §13         — transaction-send errors can mean "landed but timed out." Don't
 *                 auto-retry — the nullifier may already be burned.
 */

export type ClaimUtxoResult = {
  claimSignatures: string[];
  matchedInsertionIndex: number;
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
    // ── Step 1: Scan the tree for UTXOs addressed to this recipient ─────────
    const scan = getClaimableUtxoScannerFunction({ client });

    log.info("Scanning for claimable UTXOs", {
    recipientAddress: params.recipientAddress,
    treeIndex,
    attempt,
    });

   let scanResult;
   try {
  // Pass branded types per CONVENTIONS §1 drift #9 — U32 lives at the
  // /types subpath, not the root. The SDK does internal BigInt math on
  // these args, so a plain `number` cast via `as any` triggers
  // "Cannot mix BigInt" downstream. Brand explicitly here.
    scanResult = await scan(
      BigInt(treeIndex) as unknown as Parameters<typeof scan>[0],
      0n as unknown as Parameters<typeof scan>[1],
    );
    } catch (scanErr) {
      log.error("SCANNER threw", {
        recipientAddress: params.recipientAddress,
        message: scanErr instanceof Error ? scanErr.message : String(scanErr),
        stack: scanErr instanceof Error ? scanErr.stack : undefined,
        stage: (scanErr as { stage?: string } | null)?.stage,
      });
      throw scanErr;
    }

    const receiverUtxos = scanResult.publicReceived ?? [];

    log.info("Scan complete", {
      recipientAddress: params.recipientAddress,
      received: scanResult.received?.length ?? 0,
      publicReceived: receiverUtxos.length,
      selfBurnable: scanResult.selfBurnable?.length ?? 0,
      publicSelfBurnable: scanResult.publicSelfBurnable?.length ?? 0,
    });

    if (receiverUtxos.length === 0) {
      throw new Error(
        "No claimable UTXOs found for this recipient. The UTXO may not yet be indexed " +
          "(can take 5-30s after creation), or it may have already been claimed.",
      );
    }

    if (receiverUtxos.length > 1) {
      log.warn("Multiple unclaimed UTXOs for this recipient — claiming all", {
        recipientAddress: params.recipientAddress,
        count: receiverUtxos.length,
      });
    }

    // ── Step 2: Set up claim deps and claim ─────────────────────────────────
    const zkProver = getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver();

    const relayer = getUmbraRelayer({
      apiEndpoint: UMBRA_RELAYER,
    });

    const fetchBatchMerkleProof = getBatchMerkleProofFetcher({
      apiEndpoint: UMBRA_INDEXER,
    });

    const deps = { zkProver, relayer, fetchBatchMerkleProof };
    const claim = getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction(
      { client },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deps as any,
    );

    log.info("Submitting claim via Umbra relayer", {
      recipientAddress: params.recipientAddress,
      utxoCount: receiverUtxos.length,
    });

    try {
      const result = await claim(receiverUtxos);

      // Result shape may be { signatures: Record<...> } per docs OR
      // { batches: Map<...> } per CONVENTIONS §1 drift #4. Flatten either.
      const claimSignatures: string[] = [];
      const raw = result as unknown as {
        signatures?: Record<string | number, unknown[]>;
        batches?: Map<unknown, { txSignature?: string }>;
      };

      if (raw.signatures) {
        for (const sigs of Object.values(raw.signatures)) {
          for (const sig of sigs) {
            if (typeof sig === "string") claimSignatures.push(sig);
          }
        }
      } else if (raw.batches) {
        for (const batch of raw.batches.values()) {
          if (batch.txSignature) claimSignatures.push(batch.txSignature);
        }
      }

      log.info("Claim submitted successfully", {
        recipientAddress: params.recipientAddress,
        claimSignatures,
      });

      // Defensive: extract insertion index for logging without bigint mixing.
      let matchedInsertionIndex = 0;
      const firstUtxo = receiverUtxos[0] as unknown as {
        insertionIndex?: number | bigint;
      };
      if (firstUtxo.insertionIndex !== undefined) {
        matchedInsertionIndex = Number(firstUtxo.insertionIndex);
      }

      return { claimSignatures, matchedInsertionIndex };
    } catch (err) {
      const stage = (err as { stage?: string } | null)?.stage;

      // Full diagnostic — stack trace pinpoints which SDK function threw,
      // crucial for narrowing the bigint-mixing source if it recurs.
      log.error("Claim failed — full diagnostic", {
        recipientAddress: params.recipientAddress,
        stage,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });

      if (stage === "transaction-validate" && attempt < MAX_STALE_PROOF_RETRIES) {
        log.warn("Claim failed with stale Merkle proof — rescanning and retrying", {
          recipientAddress: params.recipientAddress,
          stage,
        });
        continue;
      }

      throw err;
    }
  }

  throw new Error("Claim retries exhausted");
}