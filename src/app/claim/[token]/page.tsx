"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { LoginButton } from "@/components/LoginButton";
import { Logo } from "@/components/Logo";
import { redactIdentifier } from "@/lib/format/identifiers";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ClaimProgress } from "@/components/ClaimProgress";
import { ClaimSuccess } from "@/components/ClaimSuccess";

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
  | { kind: "claiming" } // while POST is in flight + while ClaimProgress plays
  | { kind: "success"; signatures: string[] }
  | { kind: "error"; message: string };

function formatUsdc(baseUnits: string): string {
  const n = Number(baseUnits) / 1_000_000;
  return n.toFixed(2);
}

function ClaimShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-col flex-1 items-center p-4 sm:p-6 min-h-screen bg-background">
      <div className="w-full max-w-md flex justify-end mb-2">
        <ThemeToggle />
      </div>
      <div className="flex-1 w-full max-w-md flex flex-col items-center justify-center gap-6">
        {children}
      </div>
    </main>
  );
}

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  const { ready, authenticated, logout } = usePrivy();

  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>({ kind: "idle" });

  // Drives ClaimProgress: flips true when the API resolves, then progress plays
  // its remaining stages and calls handleProgressComplete to flip to success.
  const [isClaimComplete, setIsClaimComplete] = useState(false);
  const [pendingResult, setPendingResult] = useState<{
    signatures: string[];
  } | null>(null);

  const fetchClaimInfo = useCallback(async () => {
    if (!token) return;
    try {
      const headers: HeadersInit = {};
      if (authenticated) {
        const accessToken = await getAccessToken();
        if (accessToken) {
          headers.Authorization = "Bearer " + accessToken;
        }
      }

      const res = await fetch("/api/claim-info/" + token, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "HTTP " + res.status);
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

  useEffect(() => {
    fetchClaimInfo();
  }, [fetchClaimInfo]);

  async function handleClaim() {
    if (!token || !info) return;
    setIsClaimComplete(false);
    setPendingResult(null);
    setClaimStatus({ kind: "claiming" });

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Not signed in");

      const res = await fetch("/api/claim/" + token, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error?.message ?? data?.message ?? "HTTP " + res.status,
        );
      }

      // SDK done. Stash the result and let ClaimProgress play "Done" before
      // we flip to the success view.
      setPendingResult({ signatures: data.claimSignatures ?? [] });
      setIsClaimComplete(true);
      fetchClaimInfo();
    } catch (e) {
      setClaimStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Claim failed",
      });
      setIsClaimComplete(false);
    }
  }

  function handleProgressComplete() {
    if (!pendingResult) return;
    setClaimStatus({ kind: "success", signatures: pendingResult.signatures });
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <ClaimShell>
        <div className="text-sm text-muted">Loading your claim…</div>
      </ClaimShell>
    );
  }

  // ── Invalid / not found ──────────────────────────────────────────
  if (error || !info) {
    return (
      <ClaimShell>
        <div className="w-full rounded-xl border border-border bg-card p-8 text-center flex flex-col gap-3 card-shadow">
          <h1 className="text-xl font-semibold text-foreground">
            Claim link not found
          </h1>
          <p className="text-sm text-muted">
            This link is invalid or may have been mistyped. Double-check the URL
            or ask the sender to resend.
          </p>
        </div>
      </ClaimShell>
    );
  }

  const amount = formatUsdc(info.amountUsdcBaseUnits);
  const redacted = redactIdentifier(info.recipientIdentifier);

  // ── Already claimed ─────────────────────────────────────────────
  if (
    (info.status === "claimed" || info.claimedAt) &&
    claimStatus.kind !== "success"
  ) {
    return (
      <ClaimShell>
        <div className="w-full rounded-xl border border-border bg-card p-8 text-center flex flex-col gap-3 card-shadow">
          <h1 className="text-xl font-semibold text-foreground">
            Already claimed
          </h1>
          <p className="text-sm text-muted">
            The ${amount} USDC sent to {redacted} has already been claimed.
          </p>
        </div>
      </ClaimShell>
    );
  }

  // ── Loading (Privy not ready) ────────────────────────────────────
  if (!ready) {
    return (
      <ClaimShell>
        <div className="text-sm text-muted">Loading…</div>
      </ClaimShell>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────────
  if (!authenticated) {
    return (
      <ClaimShell>
        <div className="w-full flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3 pt-4">
            <Logo variant="lockup" size={32} />
            <h1 className="text-2xl font-semibold text-foreground text-center pt-2">
              You have ${amount} USDC waiting
            </h1>
            <p className="text-sm text-muted text-center max-w-sm">
              Someone sent you money privately. Sign in to claim it into your
              Payhaven account, yours to hold, send, or cash out.
            </p>
          </div>

          <div className="w-full">
            <LoginButton />
          </div>

          <div className="text-xs text-muted text-center max-w-sm pt-4 border-t border-border">
            Sign in with the email or phone this link was sent to ({redacted}).
            Your Payhaven balance is private, only you can see it.
          </div>
        </div>
      </ClaimShell>
    );
  }

  // ── Authenticated but WRONG identity ─────────────────────────────
  if (!info.isAuthorizedRecipient) {
    return (
      <ClaimShell>
        <div className="w-full flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3 pt-4">
            <Logo variant="lockup" size={32} />
            <h1 className="text-2xl font-semibold text-foreground text-center pt-2">
              Wrong account
            </h1>
            <p className="text-sm text-muted text-center max-w-sm">
              This claim is addressed to{" "}
              <span className="font-medium text-foreground">{redacted}</span>.
              You&apos;re signed in with a different account.
            </p>
            <p className="text-sm text-muted text-center max-w-sm pt-2">
              Sign out and sign back in using the email or phone the sender
              addressed this to.
            </p>
          </div>

          <button
            onClick={() => logout()}
            className="min-h-12 w-full px-4 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign out
          </button>
        </div>
      </ClaimShell>
    );
  }

  // ── Authorized: idle / claiming / success / error ───────────────
  return (
    <ClaimShell>
      <div className="w-full flex flex-col items-center gap-6">
        {claimStatus.kind !== "success" && (
          <div className="flex flex-col items-center gap-3 pt-4">
            <Logo variant="lockup" size={32} />
            <h1 className="text-2xl font-semibold text-foreground text-center pt-2">
              Ready to claim ${amount} USDC
            </h1>
            <p className="text-sm text-muted text-center max-w-sm">
              This will go privately into your Payhaven balance. Only you can
              see it.
            </p>
          </div>
        )}

        {claimStatus.kind === "idle" && (
          <button
            onClick={handleClaim}
            className="min-h-12 w-full px-4 bg-brand text-white rounded-md text-sm font-semibold hover:bg-brand-dark transition-colors brand-glow active:scale-[0.98]"
          >
            Claim ${amount}
          </button>
        )}

        {claimStatus.kind === "claiming" && (
          <div className="w-full p-5 bg-card border border-border rounded-xl card-shadow">
            <ClaimProgress
              isComplete={isClaimComplete}
              onComplete={handleProgressComplete}
            />
            <div className="text-xs text-muted text-center pt-2">
              The proof keeps your claim private, even we can&apos;t see which
              UTXO you&apos;re claiming.
            </div>
          </div>
        )}

        {claimStatus.kind === "success" && (
          <ClaimSuccess
            amount={amount}
            txSignature={claimStatus.signatures[0]}
          />
        )}

        {claimStatus.kind === "error" && (
          <div className="w-full flex flex-col gap-2 p-4 bg-danger/10 border border-danger/30 rounded-md">
            <div className="text-sm font-medium text-danger">Claim failed</div>
            <div className="text-xs text-danger/80">{claimStatus.message}</div>
            <button
              onClick={() => setClaimStatus({ kind: "idle" })}
              className="mt-2 text-xs font-medium text-danger underline self-start"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </ClaimShell>
  );
}