"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { LoginButton } from "@/components/LoginButton";

type ClaimInfo = {
  amountUsdcBaseUnits: string;
  recipientIdentifier: string;
  status: string;
  isExpired: boolean;
  expiresAt: string;
  claimedAt: string | null;
  isAuthorizedRecipient: boolean;
};

type ClaimStatus =
  | { kind: "idle" }
  | { kind: "claiming" }
  | { kind: "success"; signatures: string[] }
  | { kind: "error"; message: string };

function formatUsdc(baseUnits: string): string {
  const n = Number(baseUnits) / 1_000_000;
  return n.toFixed(2);
}

function redactIdentifier(identifier: string): string {
  if (identifier.includes("@")) {
    const [local, domain] = identifier.split("@");
    const visible = local.slice(0, 3);
    return `${visible}${"*".repeat(Math.max(1, local.length - 3))}@${domain}`;
  }
  if (identifier.startsWith("+")) {
    const last4 = identifier.slice(-4);
    return `${identifier.slice(0, 4)}${"*".repeat(Math.max(0, identifier.length - 8))}${last4}`;
  }
  return identifier;
}

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  const { ready, authenticated, logout } = usePrivy();

  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>({ kind: "idle" });

  const fetchClaimInfo = useCallback(async () => {
    if (!token) return;
    try {
      // Include auth token if available so server can compute isAuthorizedRecipient.
      const headers: HeadersInit = {};
      if (authenticated) {
        const accessToken = await getAccessToken();
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
      }

      const res = await fetch(`/api/claim-info/${token}`, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ClaimInfo;
      setInfo(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load claim");
    } finally {
      setLoading(false);
    }
  }, [token, authenticated]);

  // Refetch on auth change so isAuthorizedRecipient updates after login/logout.
  useEffect(() => {
    fetchClaimInfo();
  }, [fetchClaimInfo]);

  async function handleClaim() {
    if (!token || !info) return;
    setClaimStatus({ kind: "claiming" });
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Not signed in");

      const res = await fetch(`/api/claim/${token}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? data?.message ?? `HTTP ${res.status}`);
      }
      setClaimStatus({
        kind: "success",
        signatures: data.claimSignatures ?? [],
      });
      // Refetch info so the UI shows "claimed" status going forward
      fetchClaimInfo();
    } catch (e) {
      setClaimStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Claim failed",
      });
    }
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen bg-zinc-50">
        <div className="text-sm text-zinc-500">Loading your claim...</div>
      </main>
    );
  }

  // ── Invalid / not found ──────────────────────────────────────────
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

  // ── Already claimed ─────────────────────────────────────────────
  if (info.status === "claimed" || info.claimedAt) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen bg-zinc-50">
        <div className="max-w-md w-full rounded-xl border border-zinc-200 bg-white p-8 text-center flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">
            Already claimed
          </h1>
          <p className="text-sm text-zinc-600">
            The ${amount} USDC sent to {redacted} has already been claimed.
          </p>
        </div>
      </main>
    );
  }

  // ── Loading (Privy not ready) ────────────────────────────────────
  if (!ready) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen bg-zinc-50">
        <div className="text-sm text-zinc-500">Loading...</div>
      </main>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────────
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

  // ── Authenticated but WRONG identity ─────────────────────────────
  if (!info.isAuthorizedRecipient) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen bg-zinc-50">
        <div className="max-w-md w-full flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 pt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Payhaven
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900 text-center">
              Wrong account
            </h1>
            <p className="text-sm text-zinc-600 text-center max-w-sm">
              This claim is addressed to{" "}
              <span className="font-medium text-zinc-900">{redacted}</span>.
              You&apos;re signed in with a different account.
            </p>
            <p className="text-sm text-zinc-600 text-center max-w-sm pt-2">
              Sign out and sign back in using the email or phone the sender
              addressed this to.
            </p>
          </div>

          <button
            onClick={() => logout()}
            className="w-full px-4 py-3 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  // ── Authorized: ready to claim, claiming, success, error ─────────
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
            This will go privately into your Payhaven balance. Only you can see
            it.
          </p>
        </div>

        {claimStatus.kind === "idle" && (
          <button
            onClick={handleClaim}
            className="w-full px-4 py-3 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800"
          >
            Claim ${amount}
          </button>
        )}

        {claimStatus.kind === "claiming" && (
          <div className="w-full flex flex-col items-center gap-3 p-4 bg-white border border-zinc-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <Spinner />
              <span>Generating proof and claiming...</span>
            </div>
            <div className="text-xs text-zinc-500 text-center">
              This takes 5–15 seconds. The proof keeps your claim private — even
              we can&apos;t see which UTXO you&apos;re claiming.
            </div>
          </div>
        )}

        {claimStatus.kind === "success" && (
          <div className="w-full flex flex-col gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-medium text-green-900">
              ✓ Claimed
            </div>
            <p className="text-sm text-green-800">
              ${amount} USDC is now in your private Payhaven balance.
            </p>
            {claimStatus.signatures[0] && (
              <a
                href={`https://solscan.io/tx/${claimStatus.signatures[0]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-700 font-mono underline truncate"
              >
                View on Solscan
              </a>
            )}
          </div>
        )}

        {claimStatus.kind === "error" && (
          <div className="w-full flex flex-col gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm font-medium text-red-900">
              Claim failed
            </div>
            <div className="text-xs text-red-800">{claimStatus.message}</div>
            <button
              onClick={() => setClaimStatus({ kind: "idle" })}
              className="mt-2 text-xs font-medium text-red-900 underline self-start"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}