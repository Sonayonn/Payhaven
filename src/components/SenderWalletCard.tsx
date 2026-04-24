"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getAccessToken } from "@privy-io/react-auth";
import QRCode from "qrcode";

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
  const [info, setInfo] = useState<WalletInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref so the polling effect can reference the latest fetch without
  // re-subscribing on every render.
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

  // Keep the ref pointing at the latest callback.
  useEffect(() => {
    fetchWalletRef.current = fetchWallet;
  }, [fetchWallet]);

  // Polling: only when the tab is visible. Also refetch immediately when
  // the tab comes back into focus — typical pattern for "I was away, show
  // me fresh data now."
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
        fetchWalletRef.current(); // catch-up fetch on return
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

  // Generate QR once we have an address
  useEffect(() => {
    if (!info?.solanaAddress) return;
    QRCode.toDataURL(info.solanaAddress, {
      margin: 1,
      width: 200,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [info?.solanaAddress]);

  async function copyAddress() {
    if (!info?.solanaAddress) return;
    try {
      await navigator.clipboard.writeText(info.solanaAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked — silently ignore. User can tap-hold to copy.
    }
  }

  if (loading) {
    return (
      <div className="w-full rounded-xl border border-zinc-200 p-5 flex flex-col items-center justify-center min-h-[200px]">
        <div className="text-sm text-zinc-500">Setting up your wallet...</div>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="w-full rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="text-sm font-medium text-red-900">
          Couldn&apos;t load your wallet
        </div>
        <div className="mt-1 text-xs text-red-700">{error}</div>
        <button
          onClick={fetchWallet}
          className="mt-3 text-xs font-medium text-red-900 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const balance = formatUsdc(info.usdcBalanceBaseUnits);
  const isEmpty = info.usdcBalanceBaseUnits === "0";

  return (
    <div className="w-full rounded-xl border border-zinc-200 bg-white p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Your Payhaven balance
        </span>
        <button
          onClick={fetchWallet}
          className="text-xs text-zinc-500 underline"
          aria-label="Refresh balance"
        >
          Refresh
        </button>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold text-zinc-900">${balance}</span>
        <span className="text-sm text-zinc-500">USDC</span>
      </div>

      {isEmpty && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          Fund this wallet from Phantom, Solflare, or an exchange to start
          sending.
        </div>
      )}

      <div className="flex flex-col items-center gap-3 pt-2 border-t border-zinc-100">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 self-start">
          Your Payhaven wallet address
        </span>

        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="Wallet address QR code"
            className="h-[180px] w-[180px] rounded-md border border-zinc-100"
          />
        )}

        <button
          onClick={copyAddress}
          className="w-full rounded-lg bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 transition-colors px-3 py-2.5 text-xs font-mono text-zinc-900 flex items-center justify-between gap-2"
        >
          <span className="truncate">{truncateAddress(info.solanaAddress)}</span>
          <span className="text-[11px] font-sans font-medium text-zinc-600 shrink-0">
            {copied ? "Copied!" : "Tap to copy"}
          </span>
        </button>
      </div>
    </div>
  );
}