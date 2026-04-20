"use client";

import { useState } from "react";
import { sendUsdc, SendFailure } from "@/lib/api/client";
import { isValidSolanaAddress } from "@/lib/solana/address";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success"; txSignature: string }
  | { kind: "error"; code: string; message: string };

type ComposeSendProps = {
  onSuccess?: (record: {
    recipientAddress: string;
    amountUsdc: number;
    txSignature: string;
  }) => void;
};

export function ComposeSend({ onSuccess }: ComposeSendProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const recipientValid = recipient === "" || isValidSolanaAddress(recipient);
  const amountNumber = parseFloat(amount);
  const amountValid =
    amount === "" || (!isNaN(amountNumber) && amountNumber > 0);
  const canSubmit =
    recipient !== "" &&
    amount !== "" &&
    recipientValid &&
    amountValid &&
    status.kind !== "sending";

  async function handleSend() {
    if (!canSubmit) return;
    setStatus({ kind: "sending" });
    try {
      const result = await sendUsdc({
        recipientAddress: recipient,
        amountUsdc: amountNumber,
      });
      setStatus({ kind: "success", txSignature: result.createUtxoSignature });
      onSuccess?.({
        recipientAddress: recipient,
        amountUsdc: amountNumber,
        txSignature: result.createUtxoSignature,
      });
      setRecipient("");
      setAmount("");
    } catch (err) {
      if (err instanceof SendFailure) {
        setStatus({ kind: "error", code: err.code, message: err.message });
      } else {
        setStatus({
          kind: "error",
          code: "UNKNOWN",
          message: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    }
  }

  const isSending = status.kind === "sending";

  return (
    <div className="flex flex-col gap-4 w-full">
      <h2 className="text-lg font-semibold">Send USDC</h2>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-700">Recipient Solana address</span>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value.trim())}
          disabled={isSending}
          placeholder="G4JZTm8AyqXjXpJwTSPhmjF1smjRi2aK2fYfMkHXv668"
          className="px-3 py-2 border rounded font-mono text-sm disabled:bg-zinc-100"
        />
        {!recipientValid && (
          <span className="text-xs text-red-600">Invalid Solana address</span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-700">Amount (USDC)</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isSending}
          placeholder="0.10"
          className="px-3 py-2 border rounded disabled:bg-zinc-100"
        />
        {!amountValid && (
          <span className="text-xs text-red-600">
            Amount must be a positive number
          </span>
        )}
      </label>

      <button
        onClick={handleSend}
        disabled={!canSubmit}
        className="px-4 py-2 bg-zinc-900 text-white rounded disabled:bg-zinc-400 hover:bg-zinc-700"
      >
        {isSending ? "Sending..." : "Send privately"}
      </button>

      {status.kind === "sending" && (
        <div className="text-sm text-zinc-600">
          Creating shielded deposit. This takes 15-30 seconds — please don&apos;t close the tab.
        </div>
      )}

      {status.kind === "success" && (
        <div className="p-3 bg-green-50 border border-green-200 rounded flex flex-col gap-1">
          <div className="text-sm font-medium text-green-900">
            ✓ Sent privately
          </div>
          <a
            href={`https://solscan.io/tx/${status.txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-800 font-mono hover:underline break-all"
          >
            {status.txSignature}
          </a>
        </div>
      )}

      {status.kind === "error" && (
        <div className="p-3 bg-red-50 border border-red-200 rounded flex flex-col gap-1">
          <div className="text-sm font-medium text-red-900">
            {status.code === "UPSTREAM_ERROR" && status.message.includes("fetch")
              ? "Network error — please try again on a stable connection"
              : "Send failed"}
          </div>
          <div className="text-xs text-red-800">{status.message}</div>
        </div>
      )}
    </div>
  );
}