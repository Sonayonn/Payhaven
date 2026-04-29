"use client";

import { useState } from "react";
import { sendUsdc, SendFailure } from "@/lib/api/client";
import { RecipientPreview } from "./RecipientPreview";

type RecipientKind = "email" | "phone";

export type SendResult = {
  recipientIdentifier: string;
  recipientKind: RecipientKind;
  amountUsdc: number;
  txSignature: string;
  claimUrl: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success" }
  | { kind: "error"; code: string; message: string };

type ComposeSendProps = {
  onSendStart?: () => void;
  onSuccess?: (result: SendResult) => void;
  onSendError?: () => void;
};

export function ComposeSend({
  onSendStart,
  onSuccess,
  onSendError,
}: ComposeSendProps) {
  const [recipientKind, setRecipientKind] = useState<RecipientKind>("email");
  const [recipientValue, setRecipientValue] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const emailValid =
    recipientValue === "" ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientValue);
  const phoneValid =
    recipientValue === "" || /^\+?[\d\s\-()]{7,}$/.test(recipientValue);

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

  // Preview shows when the form is internally consistent, full identifier,
  // valid format, positive amount. Drives the anti-typo guard from Step 13.
  const showPreview =
    canSubmit &&
    recipientValue.length > 0 &&
    amount.length > 0 &&
    !isNaN(amountNumber);

  async function handleSend() {
    if (!canSubmit) return;
    setStatus({ kind: "sending" });
    onSendStart?.();
    try {
      const result = await sendUsdc({
        recipient: { kind: recipientKind, value: recipientValue },
        amountUsdc: amountNumber,
      });
      setStatus({ kind: "success" });
      onSuccess?.({
        recipientIdentifier: recipientValue,
        recipientKind,
        amountUsdc: amountNumber,
        txSignature: result.createUtxoSignature,
        claimUrl: result.claimUrl,
      });
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
      onSendError?.();
    }
  }

  function switchKind(next: RecipientKind) {
    if (status.kind === "sending") return;
    setRecipientKind(next);
    setRecipientValue("");
  }

  const isSending = status.kind === "sending";

  return (
    <div className="flex flex-col gap-4 w-full pb-2">
      {/* Kind toggle */}
      <div
        role="tablist"
        aria-label="Recipient type"
        className="grid grid-cols-2 gap-1 p-1 bg-subtle rounded-md"
      >
        <button
          type="button"
          role="tab"
          aria-selected={recipientKind === "email"}
          onClick={() => switchKind("email")}
          disabled={isSending}
          className={`py-2 rounded-md text-sm font-medium transition-colors ${
            recipientKind === "email"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
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
              ? "bg-card text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          } disabled:opacity-60`}
        >
          Phone
        </button>
      </div>

      {/* Recipient */}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">
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
          className="px-3 py-2.5 border border-border rounded-md text-base sm:text-sm bg-background text-foreground disabled:bg-subtle min-h-12"
        />
        {!recipientValid && (
          <span className="text-xs text-danger">
            {recipientKind === "email"
              ? "Enter a valid email address"
              : "Enter a valid phone number, include country code (+234…)"}
          </span>
        )}
      </label>

      {/* Amount */}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Amount (USDC)</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isSending}
          placeholder="0.10"
          className="px-3 py-2.5 border border-border rounded-md text-base sm:text-sm bg-background text-foreground disabled:bg-subtle min-h-12"
        />
        {!amountValid && (
          <span className="text-xs text-danger">
            Amount must be a positive number
          </span>
        )}
      </label>

      {/* Recipient preview, Step 13 anti-typo guard */}
      {showPreview && (
        <RecipientPreview
          identifier={recipientValue}
          kind={recipientKind}
          amount={amountNumber}
        />
      )}

      <button
        onClick={handleSend}
        disabled={!canSubmit}
        className="min-h-12 px-4 bg-brand text-white rounded-md text-sm font-semibold hover:bg-brand-dark disabled:bg-subtle disabled:text-faint disabled:cursor-not-allowed transition-colors brand-glow disabled:shadow-none active:scale-[0.98]"
      >
        {isSending ? "Sending…" : "Send privately"}
      </button>

      {status.kind === "error" && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md flex flex-col gap-1">
          <div className="text-sm font-medium text-danger">
            {status.code === "UPSTREAM_ERROR" && status.message.includes("fetch")
              ? "Network error, please try again on a stable connection"
              : "Send failed"}
          </div>
          <div className="text-xs text-danger/80">{status.message}</div>
        </div>
      )}
    </div>
  );
}