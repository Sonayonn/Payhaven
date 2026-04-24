"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { LoginButton } from "@/components/LoginButton";

type ClaimInfo = {
  amountUsdcBaseUnits: string;
  recipientIdentifier: string;
  status: string;
  isExpired: boolean;
  expiresAt: string;
  claimedAt: string | null;
};

function formatUsdc(baseUnits: string): string {
  const n = Number(baseUnits) / 1_000_000;
  return n.toFixed(2);
}

function redactIdentifier(identifier: string): string {
  // Email: "oli***@gmail.com"
  if (identifier.includes("@")) {
    const [local, domain] = identifier.split("@");
    const visible = local.slice(0, 3);
    return `${visible}${"*".repeat(Math.max(1, local.length - 3))}@${domain}`;
  }
  // Phone: "+234***6789"
  if (identifier.startsWith("+")) {
    const last4 = identifier.slice(-4);
    return `${identifier.slice(0, 4)}${"*".repeat(Math.max(0, identifier.length - 8))}${last4}`;
  }
  return identifier;
}

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  const { ready, authenticated } = usePrivy();

  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    async function fetchClaimInfo() {
      try {
        const res = await fetch(`/api/claim-info/${token}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as ClaimInfo;
        setInfo(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load claim");
      } finally {
        setLoading(false);
      }
    }
    fetchClaimInfo();
  }, [token]);

  // ── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen bg-zinc-50">
        <div className="text-sm text-zinc-500">Loading your claim...</div>
      </main>
    );
  }

  // ── Invalid / not found ────────────────────────────────────────────
  if (error || !info) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen bg-zinc-50">
        <div className="max-w-md w-full rounded-xl border border-zinc-200 bg-white p-8 text-center flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">
            Claim link not found
          </h1>
          <p className="text-sm text-zinc-600">
            This link is invalid or may have been mistyped. Double-check the URL
            or ask the sender to resend.
          </p>
        </div>
      </main>
    );
  }

  const amount = formatUsdc(info.amountUsdcBaseUnits);
  const redacted = redactIdentifier(info.recipientIdentifier);

  // ── Already claimed ────────────────────────────────────────────────
  if (info.status === "claimed" || info.claimedAt) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen bg-zinc-50">
        <div className="max-w-md w-full rounded-xl border border-zinc-200 bg-white p-8 text-center flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">
            Already claimed
          </h1>
          <p className="text-sm text-zinc-600">
            The $${amount} USDC sent to {redacted} has already been claimed.
          </p>
        </div>
      </main>
    );
  }

  // ── Expired ────────────────────────────────────────────────────────
  if (info.isExpired || info.status === "expired") {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen bg-zinc-50">
        <div className="max-w-md w-full rounded-xl border border-amber-200 bg-amber-50 p-8 text-center flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">
            This claim has expired
          </h1>
          <p className="text-sm text-zinc-700">
            The $${amount} sent to {redacted} was not claimed in time. Ask the
            sender to send again.
          </p>
        </div>
      </main>
    );
  }

  // ── Unauthenticated: login CTA ─────────────────────────────────────
  if (!ready) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen bg-zinc-50">
        <div className="text-sm text-zinc-500">Loading...</div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen bg-zinc-50">
        <div className="max-w-md w-full flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 pt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Payhaven
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900 text-center">
              You have ${amount} USDC waiting
            </h1>
            <p className="text-sm text-zinc-600 text-center max-w-sm">
              Someone sent you money privately. Sign in to claim it into your
              Payhaven account — yours to hold, send, or cash out.
            </p>
          </div>

          <div className="w-full">
            <LoginButton />
          </div>

          <div className="text-xs text-zinc-500 text-center max-w-sm pt-4 border-t border-zinc-200">
            Sign in with the email or phone this link was sent to ({redacted}).
            Your Payhaven balance is private — only you can see it.
          </div>
        </div>
      </main>
    );
  }

  // ── Authenticated: placeholder for Day 11 claim action ─────────────
  return (
    <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen bg-zinc-50">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 pt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Payhaven
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 text-center">
            Ready to claim ${amount} USDC
          </h1>
          <p className="text-sm text-zinc-600 text-center max-w-sm">
            Signed in. This will go into your Payhaven balance.
          </p>
        </div>

        <button
          disabled
          className="w-full px-4 py-3 bg-zinc-300 text-white rounded-lg text-sm font-medium cursor-not-allowed"
          title="Available in the next release"
        >
          Claim (coming soon)
        </button>

        <div className="text-xs text-zinc-500 text-center">
          The claim action will be live in the next release. The money is
          already on-chain, encrypted to you — it's waiting.
        </div>
      </div>
    </main>
  );
}