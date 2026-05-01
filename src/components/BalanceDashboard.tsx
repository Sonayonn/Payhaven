"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useTheme } from "next-themes";
import type { WalletInfo, EncryptedBalance, SolBalance } from "@/hooks/useBalances";
import { NumberRoller } from "./NumberRoller";
import { SendHistory } from "./SendHistory";
import { PrivacyTimeline } from "./PrivacyTimeline";
import { EmptyStateArrow } from "./EmptyStateArrow";
import { InfoTooltip } from "./InfoTooltip";

type Tab = "public" | "private";

function baseUnitsToUsdc(baseUnits: string): number {
  return Number(baseUnits) / 1_000_000;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

type Props = {
  wallet: WalletInfo | null;
  encrypted: EncryptedBalance | null;
  sol: SolBalance | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  historyRefreshKey: number;
  hasUnshieldedRecently: boolean;
  hasInitiatedCashOut: boolean;

  onShield?: () => void;
  onCashOut?: () => void;
  onSend?: () => void;
  onUnshield?: () => void;
};

export function BalanceDashboard(props: Props) {
  const [tab, setTab] = useState<Tab>("public");

  const currentEncryptedBaseUnits =
    props.encrypted?.balanceBaseUnits ?? "0";
  const prevEncryptedRef = useRef(currentEncryptedBaseUnits);
  const [lockPulseKey, setLockPulseKey] = useState(0);

  useEffect(() => {
    const prev = BigInt(prevEncryptedRef.current);
    const next = BigInt(currentEncryptedBaseUnits);
    if (next > prev) {
      setLockPulseKey((k) => k + 1);
    }
    prevEncryptedRef.current = currentEncryptedBaseUnits;
  }, [currentEncryptedBaseUnits]);

  const [historyCount, setHistoryCount] = useState(0);

  const { wallet, encrypted, loading, error, onRefresh } = props;

  if (loading) {
    return (
      <div className="w-full rounded-xl border border-border bg-card p-5 flex items-center justify-center min-h-50 card-shadow">
        <div className="text-sm text-muted">Setting up your wallet…</div>
      </div>
    );
  }

  if (error || !wallet) {
    return (
      <div className="w-full rounded-xl border border-danger/30 bg-danger/10 p-5">
        <div className="text-sm font-medium text-danger">
          Couldn&apos;t load your balances
        </div>
        <div className="mt-1 text-xs text-danger/80">{error}</div>
        <button
          onClick={onRefresh}
          className="mt-3 text-xs font-medium text-danger underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const hasFunded =
    wallet.usdcBalanceBaseUnits !== "0" ||
    (encrypted?.balanceBaseUnits ?? "0") !== "0";
  const hasPrivateBalance = (encrypted?.balanceBaseUnits ?? "0") !== "0";
  const hasSentPrivately = historyCount > 0;

  return (
    <div className="w-full rounded-xl border border-border bg-card card-shadow overflow-hidden">
      <TabBar active={tab} onChange={setTab} />
      <div className="p-5">
        {tab === "public" ? (
          <PublicView
            wallet={wallet}
            sol={props.sol}
            encryptedBalanceBaseUnits={encrypted?.balanceBaseUnits ?? "0"}
            onShield={props.onShield}
            onCashOut={props.onCashOut}
            onRefresh={onRefresh}
            timelineProps={{
              hasFunded,
              hasPrivateBalance,
              hasSentPrivately,
              hasUnshieldedRecently: props.hasUnshieldedRecently,
              hasInitiatedCashOut: props.hasInitiatedCashOut,
            }}
          />
        ) : (
          <PrivateView
            encrypted={encrypted}
            onSend={props.onSend}
            onUnshield={props.onUnshield}
            onRefresh={onRefresh}
            historyRefreshKey={props.historyRefreshKey}
            lockPulseKey={lockPulseKey}
            onHistoryCountChange={setHistoryCount}
          />
        )}
      </div>
    </div>
  );
}

// ── Tab bar ──────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  const tabs: { id: Tab; label: string; withLock?: boolean }[] = [
    { id: "public", label: "Public" },
    { id: "private", label: "Private", withLock: true },
  ];

  return (
    <div
      className="relative grid grid-cols-2 border-b border-border"
      role="tablist"
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`relative h-12 text-sm font-medium transition-colors ${
              isActive ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              {t.withLock && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
              {t.label}
            </span>
          </button>
        );
      })}
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-0.5 w-1/2 bg-brand transition-transform duration-200 ease-out"
        style={{
          transform: active === "public" ? "translateX(0)" : "translateX(100%)",
        }}
      />
    </div>
  );
}

// ── Public tab ───────────────────────────────────────────────────────────

function PublicView({
  wallet,
  sol,
  encryptedBalanceBaseUnits,
  onShield,
  onCashOut,
  onRefresh,
  timelineProps,
}: {
  wallet: WalletInfo;
  sol: SolBalance | null;
  encryptedBalanceBaseUnits: string;
  onShield?: () => void;
  onCashOut?: () => void;
  onRefresh: () => void;
  timelineProps: {
    hasFunded: boolean;
    hasPrivateBalance: boolean;
    hasSentPrivately: boolean;
    hasUnshieldedRecently: boolean;
    hasInitiatedCashOut: boolean;
  };
}) {
  const { resolvedTheme } = useTheme();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const isDark = resolvedTheme === "dark";
    QRCode.toDataURL(wallet.solanaAddress, {
      margin: 1,
      width: 200,
      color: {
        dark: isDark ? "#F9FAFB" : "#0F172A",
        light: isDark ? "#111827" : "#FAFBFC",
      },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [wallet.solanaAddress, resolvedTheme]);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(wallet.solanaAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked, long-press still works.
    }
  }

  const balance = baseUnitsToUsdc(wallet.usdcBalanceBaseUnits);
  const isEmpty = wallet.usdcBalanceBaseUnits === "0";
  const cashOutDisabled = isEmpty && encryptedBalanceBaseUnits === "0";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-faint inline-flex items-center gap-1.5">
          Public balance
          <InfoTooltip
            label="About public balance"
            content="Standard Solana wallet. Visible on Solscan. Use this for funding and cash out."
            align="left"
          />
        </span>
        <button
          onClick={onRefresh}
          className="text-xs text-muted hover:text-foreground underline transition-colors"
          aria-label="Refresh balance"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-2">
  <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
    <div className="flex items-baseline gap-1.5">
      <span className="balance-number text-5xl font-semibold text-foreground">
        $<NumberRoller value={balance} durationMs={400} />
      </span>
      <span className="text-sm text-muted">USDC</span>
    </div>
    {sol && <GasPill sol={sol} />}
  </div>

  {sol && (sol.health === "low" || sol.health === "empty") && (
    <div
      className={`text-xs ${
        sol.health === "empty" ? "text-danger" : "text-warning"
      }`}
    >
      Top up SOL for gas
    </div>
  )}
</div>

      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <button
            disabled={isEmpty}
            onClick={onShield}
            className={`w-full min-h-12 rounded-md text-sm font-semibold transition-all pr-8 ${
              isEmpty
                ? "bg-subtle text-faint cursor-not-allowed"
                : "bg-brand text-white hover:bg-brand-dark active:scale-[0.98] brand-glow"
            }`}
          >
            Shield
          </button>
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            <InfoTooltip
              label="About Shield"
              content="Move money from public to private. The shield itself is a one-time visible event; everything after is encrypted."
              align="left"
            />
          </span>
        </div>
        <div className="relative">
          <button
            disabled={cashOutDisabled}
            onClick={onCashOut}
            className={`w-full min-h-12 rounded-md border text-sm font-semibold transition-all pr-8 ${
              cashOutDisabled
                ? "border-border text-faint cursor-not-allowed"
                : "border-border text-foreground hover:bg-subtle active:scale-[0.98]"
            }`}
          >
            Cash Out
          </button>
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            <InfoTooltip
              label="About Cash Out"
              content="Convert to Naira via off-ramp partners. Coming soon, KYB onboarding in progress."
            />
          </span>
        </div>
      </div>

      <PrivacyTimeline {...timelineProps} />

      {isEmpty && (
        <div className="flex flex-col gap-3 rounded-md bg-warning/10 border border-warning/30 p-4">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold text-warning">
              Fund your Payhaven to get started
            </div>
            <div className="text-xs text-warning/80 leading-snug">
              Send any amount of Solana USDC to the address below. Works from
              Phantom, Solflare, or any exchange that supports Solana.
            </div>
          </div>
          <EmptyStateArrow />
        </div>
      )}

      <div className="flex flex-col items-center gap-3 pt-3 border-t border-border">
        <span className="text-xs font-medium uppercase tracking-wide text-faint self-start inline-flex items-center gap-1.5">
          Funding address
          <InfoTooltip
            label="About funding address"
            content="Your Payhaven wallet address on Solana. Send USDC here from Phantom, Solflare, or any exchange that supports Solana USDC."
            align="left"
          />
        </span>

        {qrDataUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qrDataUrl}
            alt="Wallet address QR code"
            className="h-45 w-45 rounded-md border border-border"
          />
        )}

        <button
          onClick={copyAddress}
          className="w-full rounded-md bg-subtle hover:bg-border active:opacity-80 transition-all px-3 py-2.5 text-xs font-mono text-foreground flex items-center justify-between gap-2 min-h-12"
        >
          <span className="truncate">{truncateAddress(wallet.solanaAddress)}</span>
          <span className="text-[11px] font-sans font-medium text-muted shrink-0">
            {copied ? "Copied!" : "Tap to copy"}
          </span>
        </button>
      </div>

      <div className="pt-3 border-t border-border flex flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Cash Out History
        </h2>
        <p className="text-sm text-muted">Coming soon</p>
      </div>
    </div>
  );
}

// ── Private tab ──────────────────────────────────────────────────────────

function PrivateView({
  encrypted,
  onSend,
  onUnshield,
  onRefresh,
  historyRefreshKey,
  lockPulseKey,
  onHistoryCountChange,
}: {
  encrypted: EncryptedBalance | null;
  onSend?: () => void;
  onUnshield?: () => void;
  onRefresh: () => void;
  historyRefreshKey: number;
  lockPulseKey: number;
  onHistoryCountChange: (count: number) => void;
}) {
  const balanceBaseUnits = encrypted?.balanceBaseUnits ?? "0";
  const balance = baseUnitsToUsdc(balanceBaseUnits);
  const isEmpty = balanceBaseUnits === "0";

  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (lockPulseKey === 0) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [lockPulseKey]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-faint inline-flex items-center gap-1.5">
          Private balance
          <InfoTooltip
            label="About private balance"
            content="Encrypted on-chain. Visible only to you. Even Payhaven can't see this number."
            align="left"
          />
        </span>
        <button
          onClick={onRefresh}
          className="text-xs text-muted hover:text-foreground underline transition-colors"
          aria-label="Refresh balance"
        >
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-2">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-privacy shrink-0 ${pulse ? "animate-lock-pulse" : ""}`}
          aria-hidden
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span className="balance-number text-5xl font-semibold text-foreground">
          $<NumberRoller value={balance} durationMs={400} />
        </span>
        <span className="text-sm text-muted">USDC</span>
      </div>

      <div className="relative">
        <button
          disabled={isEmpty}
          onClick={onSend}
          className={`w-full min-h-12 rounded-md text-sm font-semibold transition-all pr-8 ${
            isEmpty
              ? "bg-subtle text-faint cursor-not-allowed"
              : "bg-brand text-white hover:bg-brand-dark active:scale-[0.98] brand-glow"
          }`}
        >
          Send privately
        </button>
        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          <InfoTooltip
            label="About Send privately"
            content="Send privately. Recipient and amount encrypted on-chain, nobody outside Payhaven sees who got paid or how much."
          />
        </span>
      </div>

      {!isEmpty && (
        <div className="self-center inline-flex items-center gap-1.5 py-2">
          <button
            onClick={onUnshield}
            className="text-xs text-muted hover:text-foreground underline transition-colors"
          >
            Unshield to public balance
          </button>
          <InfoTooltip
            label="About Unshield"
            content="Move money from private to public. Drops privacy on this specific amount, needed for Cash Out or external transfers."
          />
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col gap-2 rounded-md bg-subtle border border-border p-4">
          <div className="text-sm font-semibold text-foreground">
            Nothing private yet
          </div>
          <div className="text-xs text-muted leading-snug">
            Shield your USDC to keep it private. Once shielded, your balance
            and every transaction are encrypted on-chain, only you can see
            them, even Payhaven can&apos;t.
          </div>
          <div className="text-xs text-faint pt-1">
            Tip: switch to the Public tab to shield, or fund your account first.
          </div>
        </div>
      )}

      <SendHistory
        refreshKey={historyRefreshKey}
        onCountChange={onHistoryCountChange}
      />
    </div>
  );
}

// ── Gas pill ─────────────────────────────────────────────────────────────

function GasPill({ sol }: { sol: SolBalance }) {
  const colors = {
    healthy: "bg-privacy/10 text-privacy border-privacy/30",
    low: "bg-warning/10 text-warning border-warning/30",
    empty: "bg-danger/10 text-danger border-danger/30",
  } as const;

  let label: string;
  if (sol.health === "empty") {
    label = "Out of gas";
  } else if (sol.health === "low") {
    label = `${sol.solDisplay} SOL · Low`;
  } else {
    label = `${sol.solDisplay} SOL · ≈ ${sol.operationsRemaining} left`;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium whitespace-nowrap ${colors[sol.health]}`}
      title={`${sol.solDisplay} SOL — for network fees. Each Payhaven transaction costs ~0.005 SOL.`}
      aria-label={`Gas balance: ${label}`}
    >
      <FuelIcon />
      {label}
    </div>
  );
}

function FuelIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="3" y1="22" x2="15" y2="22" />
      <line x1="4" y1="9" x2="14" y2="9" />
      <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" />
      <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />
    </svg>
  );
}