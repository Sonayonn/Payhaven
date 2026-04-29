"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { shieldUsdc, ShieldFailure } from "@/lib/api/client";
import { ShieldProgress } from "./ShieldProgress";

type View = "compose" | "progress" | "done";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Current public balance in base units, used for max + default amount. */
  publicBalanceBaseUnits: string;
  /** Fired on success, parent refreshes balances + bumps lock pulse. */
  onShieldComplete: () => void;
};

function baseUnitsToUsdc(baseUnits: string): number {
  return Number(baseUnits) / 1_000_000;
}

export function ShieldModal({
  open,
  onClose,
  publicBalanceBaseUnits,
  onShieldComplete,
}: Props) {
  const max = baseUnitsToUsdc(publicBalanceBaseUnits);
  const [view, setView] = useState<View>("compose");
  const [amount, setAmount] = useState<string>(max.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [txSignature, setTxSignature] = useState<string | undefined>(undefined);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset on every open. Intentionally only depends on `open`, when the
  // public balance updates mid-session (e.g., after a successful shield),
  // we don't want the modal to reset itself out of the Done view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      setView("compose");
      setError(null);
      setIsComplete(false);
      setTxSignature(undefined);
      setAmount(max.toFixed(2));
    }
  }, [open]);

  // Memoized so StagedProgress's 800ms "Done" timer isn't torn down
  // by parent rerenders (useBalances polling, etc.).
  const handleProgressComplete = useCallback(() => {
    console.log("[ShieldModal] handleProgressComplete fired");
    setView("done");
  }, []);

  // ── early return, every hook above runs on every render ─────────────────
  if (!open) return null;

  const amountNum = parseFloat(amount);
  const amountValid = !isNaN(amountNum) && amountNum > 0 && amountNum <= max;

  async function handleConfirm() {
    if (!amountValid) return;
    setError(null);
    setIsComplete(false);
    setView("progress");
    try {
      const result = await shieldUsdc({ amountUsdc: amountNum });
      setTxSignature(result.queueSignature);
      setIsComplete(true);
      onShieldComplete();
    } catch (err) {
      setView("compose");
      setIsComplete(false);
      setError(
        err instanceof ShieldFailure
          ? err.message
          : err instanceof Error
          ? err.message
          : "Shield failed",
      );
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
      aria-label="Shield USDC"
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
        className="
          relative bg-card border border-border
          rounded-t-2xl sm:rounded-2xl
          w-full sm:max-w-md sm:mx-4
          max-h-[92vh] overflow-y-auto
          card-shadow
          animate-slide-up sm:animate-scale-in
        "
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <h2 className="text-base font-semibold text-foreground">
            {view === "compose" && "Shield USDC"}
            {view === "progress" && "Shielding…"}
            {view === "done" && "Shielded"}
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
            <ShieldProgress
              isComplete={isComplete}
              onComplete={handleProgressComplete}
              txSignature={txSignature}
            />
          )}

          {view === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 animate-fade-in">
              <div className="text-sm text-muted text-center">
                ${amountNum.toFixed(2)} moved to your private balance
              </div>
              {txSignature && (
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
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

// ── Compose view ──────────────────────────────────────────────────────────

function ComposeView({
  amount,
  setAmount,
  max,
  amountValid,
  error,
  onConfirm,
  onCancel,
}: {
  amount: string;
  setAmount: (v: string) => void;
  max: number;
  amountValid: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const amountNum = parseFloat(amount);
  const willShield = !isNaN(amountNum) && amountNum > 0 ? amountNum : 0;

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="rounded-md bg-subtle border border-border p-3 text-sm text-muted">
        Shielding moves USDC from your public balance into your private
        balance. Once shielded, it&apos;s encrypted on-chain, only you can see
        the amount.
      </div>

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

      <div className="rounded-md border border-border p-3 text-xs text-muted">
        You&apos;ll move{" "}
        <span className="font-semibold text-foreground">
          ${willShield.toFixed(2)}
        </span>{" "}
        from public to private. Public goes to{" "}
        <span className="font-semibold text-foreground">
          ${(max - willShield).toFixed(2)}
        </span>
        .
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
          disabled={!amountValid}
          className="min-h-12 rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:bg-subtle disabled:text-faint disabled:cursor-not-allowed brand-glow disabled:shadow-none active:scale-[0.98] transition-all"
        >
          Shield ${willShield.toFixed(2)}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md flex flex-col gap-1">
          <div className="text-sm font-medium text-danger">Shield failed</div>
          <div className="text-xs text-danger/80">{error}</div>
        </div>
      )}
    </div>
  );
}