"use client";

import { useState } from "react";
import { sendUsdc, SendFailure } from "@/lib/api/client";
import { ShareClaimLink } from "./ShareClaimLink";

type RecipientKind = "email" | "phone";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | {
      kind: "success";
      txSignature: string;
      claimUrl: string;
      amountUsdc: number;
      recipientIdentifier: string;
      recipientKind: RecipientKind;
    }
  | { kind: "error"; code: string; message: string };

type ComposeSendProps = {
  onSuccess?: (record: {
    recipientAddress: string;
    amountUsdc: number;
    txSignature: string;
  }) => void;
};

export function ComposeSend({ onSuccess }: ComposeSendProps) {
  const [recipientKind, setRecipientKind] = useState<RecipientKind>("email");
  const [recipientValue, setRecipientValue] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const emailValid =
    recipientValue === "" ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientValue);
  const phoneValid =
    recipientValue === "" ||
    /^\+?[\d\s\-()]{7,}$/.test(recipientValue);

  const recipientValid =
    recipientKind === "email" ? emailValid : phoneValid;

  const amountNumber = parseFloat(amount);
  const amountValid =
    amount === "" || (!isNaN(amountNumber) && amountNumber > 0);

  const canSubmit =
    recipientValue !== "" &&
    amount !== "" &&
    recipientValid &&
    amountValid &&
    status.kind !== "sending";

  async function handleSend() {
    if (!canSubmit) return;
    setStatus({ kind: "sending" });
    try {
      const result = await sendUsdc({
        recipient: { kind: recipientKind, value: recipientValue },
        amountUsdc: amountNumber,
      });
      setStatus({
        kind: "success",
        txSignature: result.createUtxoSignature,
        claimUrl: result.claimUrl,
        amountUsdc: amountNumber,
        recipientIdentifier: recipientValue,
        recipientKind,
      });
      onSuccess?.({
        recipientAddress: recipientValue,
        amountUsdc: amountNumber,
        txSignature: result.createUtxoSignature,
      });
      // Note: we do NOT clear the form here anymore. The form is hidden
      // while the success panel is showing. The user clicks "Send another"
      // to reset.
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

  function switchKind(next: RecipientKind) {
    if (status.kind === "sending") return;
    setRecipientKind(next);
    setRecipientValue("");
  }

  function resetForm() {
    setStatus({ kind: "idle" });
    setRecipientValue("");
    setAmount("");
  }

  const isSending = status.kind === "sending";

  // ── Success state: show ShareClaimLink, hide the compose form ──────────
  if (status.kind === "success") {
    return (
      <div className="flex flex-col gap-4 w-full">
        <h2 className="text-lg font-semibold">Send USDC</h2>

        <ShareClaimLink
          claimUrl={status.claimUrl}
          amountUsdc={status.amountUsdc}
          recipientIdentifier={status.recipientIdentifier}
          recipientKind={status.recipientKind}
          onDone={resetForm}
        />

        <a
          href={`https://solscan.io/tx/${status.txSignature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-zinc-700 font-mono underline self-center truncate max-w-full"
        >
          View transaction on Solscan
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <h2 className="text-lg font-semibold">Send USDC</h2>

      {/* Kind toggle */}
      <div
        role="tablist"
        aria-label="Recipient type"
        className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-lg"
      >
        <button
          type="button"
          role="tab"
          aria-selected={recipientKind === "email"}
          onClick={() => switchKind("email")}
          disabled={isSending}
          className={`py-2 rounded-md text-sm font-medium transition-colors ${
            recipientKind === "email"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-600 hover:text-zinc-900"
          } disabled:opacity-60`}
        >
          Email
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={recipientKind === "phone"}
          onClick={() => switchKind("phone")}
          disabled={isSending}
          className={`py-2 rounded-md text-sm font-medium transition-colors ${
            recipientKind === "phone"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-600 hover:text-zinc-900"
          } disabled:opacity-60`}
        >
          Phone
        </button>
      </div>

      {/* Recipient */}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-700">
          {recipientKind === "email" ? "Recipient email" : "Recipient phone"}
        </span>
        <input
          key={recipientKind}
          type={recipientKind === "email" ? "email" : "tel"}
          inputMode={recipientKind === "email" ? "email" : "tel"}
          value={recipientValue}
          onChange={(e) => setRecipientValue(e.target.value.trim())}
          disabled={isSending}
          placeholder={
            recipientKind === "email"
              ? "aunty.chioma@example.com"
              : "+234 812 345 6789"
          }
          autoComplete={recipientKind === "email" ? "email" : "tel"}
          className="px-3 py-2 border rounded text-sm disabled:bg-zinc-100"
        />
        {!recipientValid && (
          <span className="text-xs text-red-600">
            {recipientKind === "email"
              ? "Enter a valid email address"
              : "Enter a valid phone number — include country code (+234...)"}
          </span>
        )}
      </label>

      {/* Amount */}
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
          Creating shielded deposit. This takes 15-30 seconds — please don&apos;t
          close the tab.
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