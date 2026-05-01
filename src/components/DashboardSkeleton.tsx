"use client";

import { AppHeader } from "./AppHeader";

/**
 * Premium-feel loading skeleton for the dashboard. Mimics the actual
 * dashboard structure (tab bar, balance, action buttons, QR placeholder)
 * so the layout doesn't shift when real content lands.
 */
export function DashboardSkeleton() {
  return (
    <>
      <AppHeader showSettings={false} />
      <main className="flex flex-col flex-1 items-center p-4 pt-6 sm:p-6 sm:pt-8">
        <div className="flex flex-col items-center gap-6 max-w-md w-full">
          <div className="w-full rounded-xl border border-border bg-card card-shadow overflow-hidden">
            {/* Tab bar */}
            <div className="grid grid-cols-2 border-b border-border">
              <div className="h-12 flex items-center justify-center">
                <Shimmer className="h-3.5 w-12" />
              </div>
              <div className="h-12 flex items-center justify-center">
                <Shimmer className="h-3.5 w-14" />
              </div>
            </div>

            {/* Public-tab content */}
            <div className="p-5 flex flex-col gap-4">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-12 w-40" />

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Shimmer className="h-12 rounded-md" />
                <Shimmer className="h-12 rounded-md" />
              </div>

              <Shimmer className="h-32 rounded-md mt-2" />

              <div className="pt-3 border-t border-border flex flex-col items-center gap-3">
                <Shimmer className="h-3 w-28 self-start" />
                <Shimmer className="h-44 w-44 rounded-md" />
                <Shimmer className="h-12 w-full rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-subtle rounded ${className ?? ""}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-border/40 to-transparent" />
    </div>
  );
}