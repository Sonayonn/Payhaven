"use client";

import { useState, useEffect } from "react";
import {
  NIGERIAN_BANKS,
  mockResolveAccount,
  INDICATIVE_NGN_PER_USD,
} from "@/lib/format/banks";

type VerifyState =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "verified"; name: string }
  | { kind: "error" };

type View = "compose" | "outcome";

type Props = {
  open: boolean;
  onClose: () => void;
  publicBalanceBaseUnits: string;
  privateBalanceBaseUnits: string;
  onRequestUnshield: () => void;
  onCashOutInitiated?: () => void;
  /** Triggers when user clicks "Withdraw to wallet" inside the
   *  Coming Soon outcome view. Parent closes Cash Out, opens Withdraw. */
  onWithdrawInstead: () => void;
};

function baseUnitsToUsdc(baseUnits: string): number {
  return Number(baseUnits) / 1_000_000;
}

function formatNaira(amount: number): string {
  return amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CashOutModal({
  open,
  onClose,
  publicBalanceBaseUnits,
  privateBalanceBaseUnits,
  onRequestUnshield,
  onCashOutInitiated,
  onWithdrawInstead,
}: Props) {
  const publicMax = baseUnitsToUsdc(publicBalanceBaseUnits);
  const privateAmount = baseUnitsToUsdc(privateBalanceBaseUnits);

  const [view, setView] = useState<View>("compose");
  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState(NIGERIAN_BANKS[0].code);
  const [accountNumber, setAccountNumber] = useState("");
  const [verifyState, setVerifyState] = useState<VerifyState>({ kind: "idle" });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset every open. Default amount to public balance for the same reason
  // shield/unshield do, gives a believable starting figure.
  useEffect(() => {
    if (open) {
      setView("compose");
      setAmount(publicMax.toFixed(2));
      setBankCode(NIGERIAN_BANKS[0].code);
      setAccountNumber("");
      setVerifyState({ kind: "idle" });
    }
  }, [open, publicMax]);

  // Re-verify whenever account number or bank changes, a verified result is
  // tied to a specific (bank, account) combination, so editing either field
  // invalidates the result.
  useEffect(() => {
    if (verifyState.kind === "verified") {
      setVerifyState({ kind: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountNumber, bankCode]);

  if (!open) return null;

  // Empty-public + nonzero-private state. Render the auto-unshield prompt
  // instead of the full form. Step 10.2 calls for an inline prompt; an
  // inline-feeling modal-section is the same idea inside a modal.
  const needsUnshieldFirst =
    publicBalanceBaseUnits === "0" && privateBalanceBaseUnits !== "0";

  const amountNum = parseFloat(amount);
  const amountValid =
    !isNaN(amountNum) && amountNum > 0 && amountNum <= publicMax;
  const accountValid = /^\d{10}$/.test(accountNumber);

  const ngnAmount = amountValid ? amountNum * INDICATIVE_NGN_PER_USD : 0;
  const selectedBank =
    NIGERIAN_BANKS.find((b) => b.code === bankCode) ?? NIGERIAN_BANKS[0];

  function startVerify() {
    if (!accountValid) return;
    setVerifyState({ kind: "verifying" });
    // 1s delay per spec. Resolves to the mock name.
    setTimeout(() => {
      setVerifyState({
        kind: "verified",
        name: mockResolveAccount(accountNumber),
      });
    }, 1000);
  }

  const canContinue =
    amountValid && accountValid && verifyState.kind === "verified";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cash out to Naira"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
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
            {view === "compose"
              ? needsUnshieldFirst
                ? "Unshield to cash out"
                : "Cash out to Naira"
              : "Coming soon"}
          </h2>
          <button
            type="button"
            onClick={onClose}
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
        </div>

        <div className="px-5 pt-5">
          {view === "compose" && needsUnshieldFirst && (
            <UnshieldFirstPrompt
              privateAmount={privateAmount}
              onUnshield={onRequestUnshield}
              onCancel={onClose}
            />
          )}

          {view === "compose" && !needsUnshieldFirst && (
            <ComposeView
              amount={amount}
              setAmount={setAmount}
              max={publicMax}
              ngnAmount={ngnAmount}
              bankCode={bankCode}
              setBankCode={setBankCode}
              accountNumber={accountNumber}
              setAccountNumber={setAccountNumber}
              accountValid={accountValid}
              amountValid={amountValid}
              verifyState={verifyState}
              onVerify={startVerify}
              canContinue={canContinue}
              onContinue={() => {
                setView("outcome");
                onCashOutInitiated?.();
              }}
            />
          )}

          {view === "outcome" && (
            <ComingSoonView
              amount={amountNum}
              ngnAmount={ngnAmount}
              bankName={selectedBank.name}
              accountNumber={accountNumber}
              accountName={
                verifyState.kind === "verified" ? verifyState.name : ""
              }
              onClose={onClose}
              onWithdrawInstead={onWithdrawInstead}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Unshield-first prompt ─────────────────────────────────────────────────

function UnshieldFirstPrompt({
  privateAmount,
  onUnshield,
  onCancel,
}: {
  privateAmount: number;
  onUnshield: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="rounded-md bg-subtle border border-border p-3 text-sm text-muted">
        Your public balance is $0, but you have{" "}
        <span className="font-semibold text-foreground">
          ${privateAmount.toFixed(2)}
        </span>{" "}
        private. Naira withdrawals settle from your public balance, unshield
        first to enable cash out.
      </div>
      <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-muted">
        Unshielding makes the amount visible on Solscan. Only unshield what
        you intend to cash out.
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onCancel}
          className="min-h-12 rounded-md border border-border text-sm font-semibold text-foreground hover:bg-subtle active:scale-[0.98] transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onUnshield}
          className="min-h-12 rounded-md bg-warning text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Unshield first
        </button>
      </div>
    </div>
  );
}

// ── Compose view ──────────────────────────────────────────────────────────

function ComposeView({
  amount,
  setAmount,
  max,
  ngnAmount,
  bankCode,
  setBankCode,
  accountNumber,
  setAccountNumber,
  accountValid,
  amountValid,
  verifyState,
  onVerify,
  canContinue,
  onContinue,
}: {
  amount: string;
  setAmount: (v: string) => void;
  max: number;
  ngnAmount: number;
  bankCode: string;
  setBankCode: (v: string) => void;
  accountNumber: string;
  setAccountNumber: (v: string) => void;
  accountValid: boolean;
  amountValid: boolean;
  verifyState: VerifyState;
  onVerify: () => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const amountNum = parseFloat(amount);

  return (
    <div className="flex flex-col gap-4 pb-2">
      {/* Amount + FX rate */}
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
          <span className="text-xs text-faint">Max: ${max.toFixed(2)} USDC</span>
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

      <div className="rounded-md bg-subtle border border-border p-3 flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-faint">
            You&apos;ll receive
          </span>
          <span className="text-xs text-faint">
            ₦{INDICATIVE_NGN_PER_USD.toLocaleString()}/USD
          </span>
        </div>
        <div className="text-2xl font-semibold text-foreground balance-number">
          ₦{formatNaira(ngnAmount)}
        </div>
        <div className="text-[11px] text-faint">
          Indicative rate, parallel market. Locked at quote time.
        </div>
      </div>

      {/* Bank */}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Bank</span>
        <select
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          className="px-3 py-2.5 border border-border rounded-md text-base sm:text-sm bg-background text-foreground min-h-12"
        >
          {NIGERIAN_BANKS.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      {/* Account number + verify */}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Account number</span>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{10}"
            maxLength={10}
            value={accountNumber}
            onChange={(e) =>
              setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            placeholder="0123456789"
            className="flex-1 px-3 py-2.5 border border-border rounded-md text-base sm:text-sm bg-background text-foreground min-h-12 font-mono"
          />
          <button
            type="button"
            onClick={onVerify}
            disabled={!accountValid || verifyState.kind === "verifying"}
            className="px-3 min-h-12 rounded-md border border-border text-sm font-semibold text-foreground hover:bg-subtle disabled:text-faint disabled:cursor-not-allowed active:scale-[0.98] transition-all whitespace-nowrap"
          >
            {verifyState.kind === "verifying" ? "Verifying…" : "Verify"}
          </button>
        </div>
        {!accountValid && accountNumber !== "" && (
          <span className="text-xs text-danger">
            Enter a 10-digit account number
          </span>
        )}
      </label>

      {/* Verified-name surface */}
      {verifyState.kind === "verified" && (
        <div className="rounded-md border border-privacy/30 bg-privacy/5 p-3 flex items-center gap-2 animate-fade-in">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-privacy shrink-0"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-faint">
              Account verified
            </span>
            <span className="text-sm font-semibold text-foreground">
              {verifyState.name}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={onContinue}
        disabled={!canContinue}
        className="min-h-12 rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:bg-subtle disabled:text-faint disabled:cursor-not-allowed brand-glow disabled:shadow-none active:scale-[0.98] transition-all"
      >
        Continue
      </button>
    </div>
  );
}

// ── Coming-soon outcome view ──────────────────────────────────────────────

function ComingSoonView({
  amount,
  ngnAmount,
  bankName,
  accountNumber,
  accountName,
  onClose,
  onWithdrawInstead,
}: {
  amount: number;
  ngnAmount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  onClose: () => void;
  onWithdrawInstead: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 pb-2 animate-fade-in">
      <div className="rounded-md bg-subtle border border-border p-3 flex flex-col gap-2">
        <div className="text-xs uppercase tracking-wide text-faint">
          Quote summary
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Cashing out</span>
          <span className="font-semibold text-foreground">
            ${amount.toFixed(2)} USDC
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">You&apos;ll receive</span>
          <span className="font-semibold text-foreground">
            ₦{formatNaira(ngnAmount)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Destination</span>
          <span className="font-semibold text-foreground text-right">
            {accountName}
            <br />
            <span className="text-xs font-mono text-muted">
              {bankName} • {accountNumber}
            </span>
          </span>
        </div>
      </div>

      <div className="rounded-md border border-warning/40 bg-warning/5 p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-warning">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Naira withdrawals, coming Q3 2026
        </div>
        <p className="text-xs text-muted">
          Cash out integrates with regulated NGN off-ramp partners through a
          batched treasury model that keeps individual recipients private from
          the partner. KYB onboarding is in progress with our launch partners.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {["Bitnob", "Yellow Card", "Nestcoin"].map((p) => (
            <span
              key={p}
              className="text-[11px] px-2 py-1 rounded-full bg-card border border-border text-muted"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-subtle p-4 flex flex-col gap-2">
        <div className="text-sm font-semibold text-foreground">
          Or, withdraw to a Solana wallet you control
        </div>
        <p className="text-xs text-muted leading-snug">
          Send your USDC to any Solana wallet | Phantom, Solflare, an exchange.
          From there, you can convert to Naira through any provider you trust.
        </p>
        <button
          onClick={onWithdrawInstead}
          className="mt-1 min-h-12 rounded-md bg-foreground text-background text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Withdraw to wallet
        </button>
      </div>

      <button
        onClick={onClose}
        className="min-h-12 rounded-md border border-border text-sm font-semibold text-foreground hover:bg-subtle active:scale-[0.98] transition-all"
      >
        Got it
      </button>
    </div>
  );
}