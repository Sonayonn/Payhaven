import "server-only";
import { address as toAddress, type Address } from "@solana/kit";
import {
  getTransactionEncoder,
  getTransactionDecoder,
} from "@solana/transactions";
import { VersionedTransaction } from "@solana/web3.js";
import { getPrivyClient } from "@/lib/privy/server";
import { log } from "@/lib/log";

export function createPrivySigner(params: {
  walletId: string;
  address: string;
}) {
  const { walletId } = params;
  const addr: Address = toAddress(params.address);
  const privy = getPrivyClient();

  const txEncoder = getTransactionEncoder();
  const txDecoder = getTransactionDecoder();

  async function signTransaction<T extends { signatures: Record<string, unknown> }>(
    tx: T,
  ): Promise<T> {
    const wire = txEncoder.encode(tx as never);
    const web3Tx = VersionedTransaction.deserialize(new Uint8Array(wire));

    const { signedTransaction } = await privy.walletApi.solana.signTransaction({
      walletId,
      transaction: web3Tx,
    });

    const signedWire = (signedTransaction as VersionedTransaction).serialize();
    const decoded = txDecoder.decode(signedWire);

    return {
      ...tx,
      signatures: { ...tx.signatures, ...decoded.signatures },
    } as T;
  }

  return {
    address: addr,

    async signMessage(message: Uint8Array) {
  const result = await privy.walletApi.solana.signMessage({
    walletId,
    message,
  });

  // Privy returns { signature: base64-string, encoding: "base64" }.
  // Umbra's X25519 derivation expects raw signature bytes (Uint8Array).
  // Convert here, at the trust boundary between Privy and Umbra.
  const signatureRaw = result.signature;
  const signature =
    typeof signatureRaw === "string"
      ? Uint8Array.from(Buffer.from(signatureRaw, (result as { encoding?: string }).encoding === "base64" ? "base64" : "base64"))
      : signatureRaw instanceof Uint8Array
        ? signatureRaw
        : new Uint8Array(signatureRaw as ArrayBufferLike);

  log.info("Privy signMessage completed", {
    walletId,
    messageLen: message.length,
    sigLen: signature.length,
    sigIsUint8Array: signature instanceof Uint8Array,
  });

  return {
    signedMessage: message,
    signature,
  };
   },
    signTransaction,

    async signTransactions<T extends { signatures: Record<string, unknown> }>(
      txs: readonly T[],
    ): Promise<T[]> {
      return Promise.all(txs.map((tx) => signTransaction(tx)));
    },
  };
}

export type PrivySigner = ReturnType<typeof createPrivySigner>;