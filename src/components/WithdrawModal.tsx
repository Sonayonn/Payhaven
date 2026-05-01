"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@privy-io/react-auth";
import { StagedProgress } from "./StagedProgress";

type View = "compose" | "progress" | "done";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Current public balance, used for max + default amount. */
  publicBalanceBaseUnits: string;
  /** Fired on successful confirmation; parent refreshes balances. */
  onWithdrawComplete: () => void;
};

function baseUnitsToUsdc(baseUnits: string): number {
  return Number(baseUnits) / 1_000_000;
}

const STAGES = [
  { id: "validate", label: "Validating destination…" },
  { id: "submit", label: "Submitting to Solana…" },
  { id: "confirm", label: "Confirming on-chain…" },
];

const ADVANCE_AT_MS = [2000, 8000];

export function WithdrawModal({
  open,
  onClose,
  publicBalanceBaseUnits,
  onWithdrawComplete,
}: Props) {
  const maxBaseUnits = BigInt(publicBalanceBaseUnits);
  const max = Math.floor(Number(maxBaseUnits) / 10_000) / 100;

  const [view, setView] = useState<View>("compose");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [amount, setAmount] = useState<string>(max.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [txSignature, setTxSignature] = useState<string | undefined>(undefined);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      setView("compose");
      setError(null);
      setIsComplete(false);
      setTxSignature(undefined);
      setDestinationAddress("");
      setAmount(max.toFixed(2));
    }
  }, [open]);

  const handleProgressComplete = useCallback(() => {
    setView("done");
  }, []);

  if (!open) return null;

  const amountNum = parseFloat(amount);
  const amountBaseUnits =
    isNaN(amountNum) || amountNum <= 0
      ? 0n
      : BigInt(Math.round(amountNum * 1_000_000));
  const amountValid =
    !isNaN(amountNum) && amountNum > 0 && amountBaseUnits <= maxBaseUnits;

  const addressTrimmed = destinationAddress.trim();
  const addressValid =
    addressTrimmed.length >= 32 && addressTrimmed.length <= 44;

  const canConfirm = addressValid && amountValid;

  async function handleConfirm() {
    if (!canConfirm) return;
    setError(null);
    setIsComplete(false);
    setView("progress");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          destinationAddress: addressTrimmed,
          amountUsdc: amountNum,
        }),
      });
      const body = await res.json();
      if (!res.ok || body.ok !== true) {
        throw new Error(body?.error?.message ?? "Withdraw failed");
      }
      setTxSignature(body.signature as string);
      setIsComplete(true);
      onWithdrawComplete();
    } catch (err) {
      setView("compose");
      setIsComplete(false);
      setError(err instanceof Error ? err.message : "Withdraw failed");
    }
  }

  function requestClose() {
    if (view === "progress") return;
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Withdraw USDC"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in cursor-default"
        tabIndex={-1}
      />

      <div
        className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md sm:mx-4 max-h-[92vh] overflow-y-auto card-shadow animate-slide-up sm:animate-scale-in"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <h2 className="text-base font-semibold text-foreground">
            {view === "compose" && "Withdraw USDC"}
            {view === "progress" && "Withdrawing…"}
            {view === "done" && "Withdrawn"}
          </h2>
          {view !== "progress" && (
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="w-8 h-8 -mr-1 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-subtle transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="px-5 pt-5">
          {view === "compose" && (
            <ComposeView
              destinationAddress={destinationAddress}
              setDestinationAddress={setDestinationAddress}
              addressValid={addressValid}
              amount={amount}
              setAmount={setAmount}
              max={max}
              amountValid={amountValid}
              error={error}
              onConfirm={handleConfirm}
              onCancel={requestClose}
            />
          )}

          {view === "progress" && (
            <StagedProgress
              stages={STAGES}
              advanceAtMs={ADVANCE_AT_MS}
              isComplete={isComplete}
              onComplete={handleProgressComplete}
            />
          )}

          {view === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 animate-fade-in">
              <div className="text-sm text-muted text-center">
                ${parseFloat(amount).toFixed(2)} sent to{" "}
                <span className="font-mono">
                  {destinationAddress.slice(0, 6)}…{destinationAddress.slice(-6)}
                </span>
              </div>
              {txSignature && (
                <a
                  href={"https://solscan.io/tx/" + txSignature}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted hover:text-foreground font-mono underline"
                >
                  View on Solscan →
                </a>
              )}
              <button
                onClick={onClose}
                className="w-full min-h-12 rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark active:scale-[0.98] brand-glow transition-all"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComposeView({
  destinationAddress,
  setDestinationAddress,
  addressValid,
  amount,
  setAmount,
  max,
  amountValid,
  error,
  onConfirm,
  onCancel,
}: {
  destinationAddress: string;
  setDestinationAddress: (v: string) => void;
  addressValid: boolean;
  amount: string;
  setAmount: (v: string) => void;
  max: number;
  amountValid: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const amountNum = parseFloat(amount);

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="rounded-md bg-subtle border border-border p-3 text-sm text-muted leading-snug">
        Send your USDC to any Solana wallet | Phantom, Solflare, an exchange,
        or any other Solana address. Funds arrive in seconds.
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Destination address</span>
        <input
          type="text"
          value={destinationAddress}
          onChange={(e) => setDestinationAddress(e.target.value)}
          placeholder="Phantom, Solflare, or any Solana wallet address"
          className="px-3 py-2.5 border border-border rounded-md text-base sm:text-sm bg-background text-foreground min-h-12 font-mono"
        />
        {!addressValid && destinationAddress.trim() !== "" && (
          <span className="text-xs text-danger">
            Doesn&apos;t look like a valid Solana address
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Amount (USDC)</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          max={max}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="px-3 py-2.5 border border-border rounded-md text-base sm:text-sm bg-background text-foreground min-h-12"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-faint">
            Max: ${max.toFixed(2)} USDC
          </span>
          <button
            type="button"
            onClick={() => setAmount(max.toFixed(2))}
            className="text-xs font-medium text-brand hover:text-brand-dark"
          >
            Use max
          </button>
        </div>
        {!amountValid && amount !== "" && (
          <span className="text-xs text-danger">
            {amountNum > max
              ? "Amount exceeds your public balance"
              : "Enter a positive amount"}
          </span>
        )}
      </label>

      <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-muted leading-snug">
        <div className="font-semibold text-warning mb-1">
          Double-check the address
        </div>
        Solana transfers are final | if you send to the wrong address, the
        funds can&apos;t be recovered. The withdrawal will be visible on Solscan.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onCancel}
          className="min-h-12 rounded-md border border-border text-sm font-semibold text-foreground hover:bg-subtle active:scale-[0.98] transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!addressValid || !amountValid}
          className="min-h-12 rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:bg-subtle disabled:text-faint disabled:cursor-not-allowed brand-glow disabled:shadow-none active:scale-[0.98] transition-all"
        >
          Withdraw
        </button>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md flex flex-col gap-1">
          <div className="text-sm font-medium text-danger">Withdraw failed</div>
          <div className="text-xs text-danger/80">{error}</div>
        </div>
      )}
    </div>
  );
}