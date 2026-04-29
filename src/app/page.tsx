"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { LoginButton } from "@/components/LoginButton";
import { BalanceDashboard } from "@/components/BalanceDashboard";
import { SendModal } from "@/components/SendModal";
import { ShieldModal } from "@/components/ShieldModal";
import { UnshieldModal } from "@/components/UnshieldModal";
import { CashOutModal } from "@/components/CashOutModal";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useBalances } from "@/hooks/useBalances";
 import Link from "next/link";

export default function Home() {
  const { ready, authenticated } = usePrivy();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [sendOpen, setSendOpen] = useState(false);
  const [shieldOpen, setShieldOpen] = useState(false);
  const [unshieldOpen, setUnshieldOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [reopenCashOutAfterUnshield, setReopenCashOutAfterUnshield] =
    useState(false);

  // Session flags for PrivacyTimeline. Reset on page refresh, that's the
  // right semantic for "recently." A fresh page load is a fresh footprint;
  // these only show steps the user has actually performed in this session.
  const [hasUnshieldedRecently, setHasUnshieldedRecently] = useState(false);
  const [hasInitiatedCashOut, setHasInitiatedCashOut] = useState(false);

  const balances = useBalances();

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "send" && ready && authenticated) {
      setSendOpen(true);
      router.replace("/", { scroll: false });
    }
  }, [searchParams, ready, authenticated, router]);

  return (
    <main className="flex flex-col flex-1 items-center p-4 pt-6 sm:p-6 sm:pt-8">
      <div className="w-full max-w-md flex justify-end gap-2 mb-2">
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="Settings"
          className="w-10 h-10 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-subtle transition-colors"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>

      <div className="flex flex-col items-center gap-6 max-w-md w-full">
        <div className="flex flex-col items-center gap-3 pt-4">
          <Logo variant="lockup" size={40} />
          <p className="text-muted text-sm">Private USDC remittance.</p>
        </div>

        <LoginButton />

        {ready && authenticated && (
          <>
            <BalanceDashboard
              wallet={balances.wallet}
              encrypted={balances.encrypted}
              loading={balances.loading}
              error={balances.error}
              onRefresh={balances.refresh}
              historyRefreshKey={historyRefreshKey}
              hasUnshieldedRecently={hasUnshieldedRecently}
              hasInitiatedCashOut={hasInitiatedCashOut}
              onSend={() => setSendOpen(true)}
              onShield={() => setShieldOpen(true)}
              onUnshield={() => setUnshieldOpen(true)}
              onCashOut={() => setCashOutOpen(true)}
            />

            <SendModal
              open={sendOpen}
              onClose={() => {
                setSendOpen(false);
                balances.refresh();
              }}
              onSendComplete={() => {
                setHistoryRefreshKey((k) => k + 1);
                // refresh moved to onClose.
              }}
            />

            <ShieldModal
              open={shieldOpen}
              onClose={() => {
                setShieldOpen(false);
                // Refresh AFTER the modal closes so the number-roll plays
                // on the dashboard with the user's full attention, not
                // hidden behind a modal that's still up.
                balances.refresh();
              }}
              publicBalanceBaseUnits={
                balances.wallet?.usdcBalanceBaseUnits ?? "0"
              }
              onShieldComplete={() => {
                // Intentionally empty, refresh moved to onClose.
                // The shield itself succeeded; the dashboard will reflect
                // it the moment the user dismisses the modal.
              }}
            />

            <UnshieldModal
              open={unshieldOpen}
              onClose={() => {
                setUnshieldOpen(false);
                balances.refresh();
                if (reopenCashOutAfterUnshield) {
                  setReopenCashOutAfterUnshield(false);
                  setCashOutOpen(true);
                }
              }}
              privateBalanceBaseUnits={
                balances.encrypted?.balanceBaseUnits ?? "0"
              }
              onUnshieldComplete={() => {
                setHasUnshieldedRecently(true);
              }}
            />

            <CashOutModal
              open={cashOutOpen}
              onClose={() => setCashOutOpen(false)}
              publicBalanceBaseUnits={
                balances.wallet?.usdcBalanceBaseUnits ?? "0"
              }
              privateBalanceBaseUnits={
                balances.encrypted?.balanceBaseUnits ?? "0"
              }
              onRequestUnshield={() => {
                setReopenCashOutAfterUnshield(true);
                setCashOutOpen(false);
                setUnshieldOpen(true);
              }}
              onCashOutInitiated={() => setHasInitiatedCashOut(true)}
            />
          </>
        )}
      </div>
    </main>
  );
}