"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BalanceDashboard } from "@/components/BalanceDashboard";
import { SendModal } from "@/components/SendModal";
import { ShieldModal } from "@/components/ShieldModal";
import { UnshieldModal } from "@/components/UnshieldModal";
import { CashOutModal } from "@/components/CashOutModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { AppHeader } from "@/components/AppHeader";
import { useBalances } from "@/hooks/useBalances";

export function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [sendOpen, setSendOpen] = useState(false);
  const [shieldOpen, setShieldOpen] = useState(false);
  const [unshieldOpen, setUnshieldOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [reopenCashOutAfterUnshield, setReopenCashOutAfterUnshield] =
    useState(false);

  const [hasUnshieldedRecently, setHasUnshieldedRecently] = useState(false);
  const [hasInitiatedCashOut, setHasInitiatedCashOut] = useState(false);

  const balances = useBalances();

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "send") {
      setSendOpen(true);
      router.replace("/", { scroll: false });
    }
  }, [searchParams, router]);

  return (
    <>
      <AppHeader />

      <main className="flex flex-col flex-1 items-center p-4 pt-6 sm:p-6 sm:pt-8">
        <div className="flex flex-col items-center gap-6 max-w-md w-full">
          <BalanceDashboard
            wallet={balances.wallet}
            encrypted={balances.encrypted}
            sol={balances.sol}
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
            }}
          />

          <ShieldModal
            open={shieldOpen}
            onClose={() => {
              setShieldOpen(false);
              balances.refresh();
            }}
            publicBalanceBaseUnits={
              balances.wallet?.usdcBalanceBaseUnits ?? "0"
            }
            onShieldComplete={() => {}}
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
            onWithdrawInstead={() => {
              setCashOutOpen(false);
              setWithdrawOpen(true);
            }}
          />

          <WithdrawModal
            open={withdrawOpen}
            onClose={() => {
              setWithdrawOpen(false);
              balances.refresh();
            }}
            publicBalanceBaseUnits={
              balances.wallet?.usdcBalanceBaseUnits ?? "0"
            }
            onWithdrawComplete={() => {}}
          />
        </div>
      </main>
    </>
  );
}