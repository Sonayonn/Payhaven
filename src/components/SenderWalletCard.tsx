"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getAccessToken } from "@privy-io/react-auth";
import QRCode from "qrcode";
import { useTheme } from "next-themes";

const POLL_INTERVAL_MS = 30_000;

function formatUsdc(baseUnits: string): string {
  const n = Number(baseUnits) / 1_000_000;
  return n.toFixed(2);
}

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

type WalletInfo = {
  solanaAddress: string;
  usdcBalanceBaseUnits: string;
};

export function SenderWalletCard() {
  const { resolvedTheme } = useTheme();
  const [info, setInfo] = useState<WalletInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletRef = useRef<() => Promise<void>>(async () => {});

  const fetchWallet = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No access token");
      const res = await fetch("/api/sender-wallet", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as WalletInfo;
      setInfo(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletRef.current = fetchWallet;
  }, [fetchWallet]);

  useEffect(() => {
    fetchWalletRef.current();

    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (interval !== null) return;
      interval = setInterval(() => {
        fetchWalletRef.current();
      }, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (interval === null) return;
      clearInterval(interval);
      interval = null;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchWalletRef.current();
        startPolling();
      } else {
        stopPolling();
      }
    }

    if (document.visibilityState === "visible") {
      startPolling();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Regenerate QR when address OR theme changes, QR contrast must
  // match the surrounding card so it reads correctly in both modes.
  useEffect(() => {
    if (!info?.solanaAddress) return;
    const isDark = resolvedTheme === "dark";
    QRCode.toDataURL(info.solanaAddress, {
      margin: 1,
      width: 200,
      color: {
        dark: isDark ? "#F9FAFB" : "#0F172A",   // foreground in current mode
        light: isDark ? "#111827" : "#FFFFFF",  // card bg in current mode
      },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [info?.solanaAddress, resolvedTheme]);

  async function copyAddress() {
    if (!info?.solanaAddress) return;
    try {
      await navigator.clipboard.writeText(info.solanaAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked, user can tap-hold to copy manually.
    }
  }

  if (loading) {
    return (
      <div className="w-full rounded-xl border border-border p-5 flex flex-col items-center justify-center min-h-50">
        <div className="text-sm text-muted">Setting up your wallet...</div>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="w-full rounded-xl border border-danger/30 bg-danger/10 p-5">
        <div className="text-sm font-medium text-danger">
          Couldn&apos;t load your wallet
        </div>
        <div className="mt-1 text-xs text-danger/80">{error}</div>
        <button
          onClick={fetchWallet}
          className="mt-3 text-xs font-medium text-danger underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const balance = formatUsdc(info.usdcBalanceBaseUnits);
  const isEmpty = info.usdcBalanceBaseUnits === "0";

  return (
    <div className="w-full rounded-xl border border-border bg-card p-5 flex flex-col gap-4 card-shadow">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">
          Your Payhaven balance
        </span>
        <button
          onClick={fetchWallet}
          className="text-xs text-muted hover:text-foreground underline transition-colors"
          aria-label="Refresh balance"
        >
          Refresh
        </button>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="balance-number text-4xl font-semibold text-foreground">
          ${balance}
        </span>
        <span className="text-sm text-muted">USDC</span>
      </div>

      {isEmpty && (
        <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-xs text-warning">
          Fund this wallet from Phantom, Solflare, or an exchange to start
          sending.
        </div>
      )}

      <div className="flex flex-col items-center gap-3 pt-3 border-t border-border">
        <span className="text-xs font-medium uppercase tracking-wide text-faint self-start">
          Your Payhaven wallet address
        </span>

        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="Wallet address QR code"
            className="h-45 w-45 rounded-md border border-border"
          />
        )}

        <button
          onClick={copyAddress}
          className="w-full rounded-md bg-subtle hover:bg-border active:opacity-80 transition-all px-3 py-2.5 text-xs font-mono text-foreground flex items-center justify-between gap-2"
        >
          <span className="truncate">{truncateAddress(info.solanaAddress)}</span>
          <span className="text-[11px] font-sans font-medium text-muted shrink-0">
            {copied ? "Copied!" : "Tap to copy"}
          </span>
        </button>
      </div>
    </div>
  );
}