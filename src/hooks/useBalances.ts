"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getAccessToken } from "@privy-io/react-auth";

const POLL_INTERVAL_MS = 30_000;

export type WalletInfo = {
  solanaAddress: string;
  usdcBalanceBaseUnits: string;
};

export type EncryptedBalance = {
  state: string;
  balanceBaseUnits: string;
};

type State = {
  wallet: WalletInfo | null;
  encrypted: EncryptedBalance | null;
  loading: boolean;
  error: string | null;
};

/**
 * Fetches public + encrypted balances together with visibility-aware polling.
 * Exposes refresh() so action handlers (shield/send/unshield/claim) can trigger
 * an immediate re-fetch after the on-chain mutation lands.
 *
 * Partial success is fine: encrypted-balance can fail without wiping public.
 * Public wallet failure surfaces as `error` because everything else depends on it.
 */
export function useBalances() {
  const [state, setState] = useState<State>({
    wallet: null,
    encrypted: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setState((prev) => ({ ...prev, loading: false, error: "Not signed in" }));
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    const [walletResult, encResult] = await Promise.allSettled([
      fetch("/api/sender-wallet", { headers }).then((r) =>
        r.json().then((b) => ({ ok: r.ok, body: b })),
      ),
      fetch("/api/encrypted-balance", { headers }).then((r) =>
        r.json().then((b) => ({ ok: r.ok, body: b })),
      ),
    ]);

    setState((prev) => {
      const next: State = { ...prev, loading: false };

      if (
        walletResult.status === "fulfilled" &&
        walletResult.value.ok &&
        walletResult.value.body.ok === true
      ) {
        const b = walletResult.value.body;
        next.wallet = {
          solanaAddress: b.solanaAddress,
          usdcBalanceBaseUnits: b.usdcBalanceBaseUnits,
        };
        next.error = null;
      } else if (walletResult.status === "rejected") {
        next.error =
          walletResult.reason instanceof Error
            ? walletResult.reason.message
            : "Failed to load wallet";
      } else if (
        walletResult.status === "fulfilled" &&
        !walletResult.value.ok
      ) {
        next.error = walletResult.value.body?.message ?? "Failed to load wallet";
      }

      if (
        encResult.status === "fulfilled" &&
        encResult.value.ok &&
        encResult.value.body.ok === true
      ) {
        next.encrypted = {
          state: encResult.value.body.state,
          balanceBaseUnits: encResult.value.body.balanceBaseUnits,
        };
      }
      // Encrypted failures are silent, show last-known or null, no global error.
      return next;
    });
  }, []);

  // Stable ref so polling keeps calling the latest refresh closure.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    refreshRef.current();

    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (interval !== null) return;
      interval = setInterval(() => refreshRef.current(), POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (interval === null) return;
      clearInterval(interval);
      interval = null;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshRef.current();
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

  return { ...state, refresh };
}