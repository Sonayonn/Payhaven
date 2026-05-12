"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { redactIdentifier } from "@/lib/format/identifiers";
import { ClaimCard } from "@/components/claim/ClaimCard";
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
  | { kind: "claiming"; claimedCount: number; lastSignature: string | null }
  | { kind: "success"; signatures: string[]; totalClaimed: number }
  | { kind: "error"; message: string };

function formatUsdc(baseUnits: string): string {
  const n = Number(baseUnits) / 1_000_000;
  return n.toFixed(2);
}

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  const { ready, authenticated, login, logout } = usePrivy();

  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>({ kind: "idle" });

  // Accumulate signatures across multiple drain calls
  const allSignaturesRef = useRef<string[]>([]);

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

  /**
   * Performs ONE claim call against /api/claim/[token].
   * Returns { remainingUtxoCount, signatures, queueEmpty } so the caller
   * can decide whether to loop.
   */
  const performSingleClaim = useCallback(async (): Promise<{
    remainingUtxoCount: number;
    signatures: string[];
    queueEmpty: boolean;
  }> => {
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

    return {
      remainingUtxoCount: data.remainingUtxoCount ?? 0,
      signatures: data.claimSignatures ?? [],
      queueEmpty: data.queueEmpty === true,
    };
  }, [token]);

  /**
   * Drains the recipient's UTXO queue by calling /api/claim/[token]
   * repeatedly until queueEmpty=true (or remainingUtxoCount=0).
   *
   * Each call generates a ZK proof server-side and takes ~2-3 minutes
   * cold-start, much less warm. UI updates progress after each call.
   *
   * Safety cap: max 20 iterations to prevent infinite loops if the API
   * misbehaves. Real users will have 1-2 UTXOs; the cap exists for
   * test environments where queues can back up.
   */
  const drainQueue = useCallback(async () => {
    allSignaturesRef.current = [];
    setClaimStatus({ kind: "claiming", claimedCount: 0, lastSignature: null });

    const MAX_DRAINS = 20;
    let claimedCount = 0;

    for (let i = 0; i < MAX_DRAINS; i++) {
      try {
        const result = await performSingleClaim();

        if (result.queueEmpty || result.signatures.length === 0) {
          // Queue is empty. We're done.
          break;
        }

        // Record this claim's signature(s)
        allSignaturesRef.current.push(...result.signatures);
        claimedCount += 1;

        // Update UI with progress
        setClaimStatus({
          kind: "claiming",
          claimedCount,
          lastSignature: result.signatures[0] ?? null,
        });

        // If the server says queue is now empty, stop
        if (result.remainingUtxoCount === 0) {
          break;
        }

        // Otherwise, loop and claim the next UTXO
      } catch (e) {
        // If we've already claimed something, treat the error as partial success
        if (claimedCount > 0) {
          setClaimStatus({
            kind: "success",
            signatures: allSignaturesRef.current,
            totalClaimed: claimedCount,
          });
          fetchClaimInfo();
          return;
        }
        // Otherwise, surface the error
        setClaimStatus({
          kind: "error",
          message: e instanceof Error ? e.message : "Claim failed",
        });
        return;
      }
    }

    // Drain complete — show success
    setClaimStatus({
      kind: "success",
      signatures: allSignaturesRef.current,
      totalClaimed: claimedCount,
    });
    fetchClaimInfo();
  }, [performSingleClaim, fetchClaimInfo]);

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <ClaimCard>
        <SkeletonCard />
      </ClaimCard>
    );
  }

  // ── Invalid / not found ──────────────────────────────────────────
  if (error || !info) {
    return (
      <ClaimCard>
        <PremiumPanel
          icon="warning"
          title="Claim link not found"
          body="This link is invalid or may have been mistyped. Double-check the URL or ask the sender to resend."
        />
      </ClaimCard>
    );
  }

  const amount = formatUsdc(info.amountUsdcBaseUnits);
  const redacted = redactIdentifier(info.recipientIdentifier);

  // ── Already claimed ──────────────────────────────────────────────
  if (
    (info.status === "claimed" || info.claimedAt) &&
    claimStatus.kind !== "success" &&
    claimStatus.kind !== "claiming"
  ) {
    return (
      <ClaimCard>
        <PremiumPanel
          icon="check"
          title="Already claimed"
          body={`The $${amount} USDC sent to ${redacted} has already been claimed.`}
        />
      </ClaimCard>
    );
  }

  // ── Privy not yet ready ──────────────────────────────────────────
  if (!ready) {
    return (
      <ClaimCard>
        <SkeletonCard />
      </ClaimCard>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────────
  if (!authenticated) {
    return (
      <ClaimCard>
        <HeroAmountCard
          amount={amount}
          subtitle="is waiting for you"
          locked
        />
        <div className="rounded-xl border border-border bg-card p-6 card-shadow flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-semibold text-foreground">
              Sign in to claim
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              Someone sent you money privately. Sign in with the email or
              phone this link was addressed to.
            </p>
          </div>

          <button
            onClick={login}
            className="min-h-12 w-full rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark active:scale-[0.98] brand-glow transition-all"
          >
            Sign in to continue
          </button>

          <div className="rounded-md bg-subtle border border-border p-3 text-xs text-muted leading-snug">
            <span className="font-semibold text-foreground">Heads up:</span>{" "}
            Sign in with{" "}
            <span className="font-mono text-foreground">{redacted}</span>.
            Only that account can claim this payment.
          </div>
        </div>
      </ClaimCard>
    );
  }

  // ── Authenticated but WRONG identity ─────────────────────────────
  if (!info.isAuthorizedRecipient) {
    return (
      <ClaimCard>
        <PremiumPanel icon="warning" title="Wrong account" body="">
          <p className="text-sm text-muted leading-relaxed">
            This payment is addressed to{" "}
            <span className="font-semibold font-mono text-foreground">
              {redacted}
            </span>
            . You&apos;re signed in with a different account.
          </p>
          <p className="text-sm text-muted leading-relaxed pt-2">
            Sign out and sign back in with the email or phone above.
          </p>
          <button
            onClick={() => logout()}
            className="mt-2 min-h-12 w-full rounded-md bg-foreground text-background text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-opacity"
          >
            Sign out
          </button>
        </PremiumPanel>
      </ClaimCard>
    );
  }

  // ── Success ──────────────────────────────────────
  if (claimStatus.kind === "success") {
  return (
    <ClaimCard>
      <ClaimSuccess
        amount={amount}
        txSignature={claimStatus.signatures[0]}
        totalClaimed={claimStatus.totalClaimed}
        allSignatures={claimStatus.signatures}
      />
    </ClaimCard>
  );
}

  // ── Authorized: idle / claiming / error ──────────────────────────
  return (
    <ClaimCard>
      {claimStatus.kind === "idle" && (
        <>
          <HeroAmountCard
            amount={amount}
            subtitle="ready to claim"
            locked
          />
          <div className="rounded-xl border border-border bg-card p-6 card-shadow flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-semibold text-foreground">
                Ready to claim privately
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                This will go privately into your Payhaven balance. Encrypted
                on-chain | only you can see it.
              </p>
            </div>

            <button
              onClick={drainQueue}
              className="min-h-12 w-full rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark active:scale-[0.98] brand-glow transition-all"
            >
              Claim ${amount}
            </button>

            <div className="flex items-center gap-2 text-xs text-faint pt-1">
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
                className="text-privacy"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Gasless | no SOL required to claim.</span>
            </div>
          </div>
        </>
      )}

      {claimStatus.kind === "claiming" && (
        <div className="rounded-xl border border-border bg-card p-6 card-shadow flex flex-col gap-4">
          <ClaimProgress
            isComplete={false}
            onComplete={() => {
              /* drainQueue handles completion */
            }}
          />
          {claimStatus.claimedCount > 0 && (
            <div className="rounded-md bg-privacy/5 border border-privacy/20 p-3 text-xs text-foreground leading-relaxed">
              <span className="font-semibold text-privacy">
                {claimStatus.claimedCount} claim
                {claimStatus.claimedCount > 1 ? "s" : ""} completed
              </span>
              {" — "}
              checking for more queued payments...
            </div>
          )}
          <div className="text-xs text-muted text-center leading-relaxed border-t border-border pt-2">
            The proof keeps your claim private — even Payhaven can&apos;t see
            which UTXO you&apos;re claiming.
          </div>
        </div>
      )}

      {claimStatus.kind === "error" && (
        <PremiumPanel icon="warning" title="Claim failed" body="">
          <p className="text-sm text-danger/90 leading-relaxed">
            {claimStatus.message}
          </p>
          <button
            onClick={() => setClaimStatus({ kind: "idle" })}
            className="mt-3 min-h-12 w-full rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark active:scale-[0.98] brand-glow transition-all"
          >
            Try again
          </button>
        </PremiumPanel>
      )}
    </ClaimCard>
  );
}

// ── Hero amount card, the visual anchor ─────────────────────────────────

function HeroAmountCard({
  amount,
  subtitle,
  locked,
}: {
  amount: string;
  subtitle: string;
  locked?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 card-shadow text-center flex flex-col items-center gap-3">
      <div className="text-xs font-medium uppercase tracking-wider text-faint">
        You have a payment
      </div>
      <div className="flex items-center justify-center gap-2.5">
        {locked && (
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-privacy animate-lock-pulse"
            aria-hidden
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
        <span className="balance-number text-5xl sm:text-6xl font-semibold text-foreground tracking-tight">
          ${amount}
        </span>
      </div>
      <div className="text-sm text-muted">USDC {subtitle}</div>
    </div>
  );
}

// ── Premium panel ──────────────────────────────────────────────────────

function PremiumPanel({
  icon,
  title,
  body,
  children,
}: {
  icon: "warning" | "check";
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-8 card-shadow flex flex-col items-center text-center gap-4">
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center ${
          icon === "warning"
            ? "bg-warning/10 border border-warning/30"
            : "bg-privacy/10 border border-privacy/30"
        }`}
      >
        {icon === "warning" ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-warning"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-privacy"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
          {title}
        </h1>
        {body && <p className="text-sm text-muted leading-relaxed">{body}</p>}
      </div>
      {children && <div className="w-full">{children}</div>}
    </div>
  );
}

// ── Skeleton for loading states ────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 card-shadow flex flex-col items-center gap-4 animate-fade-in">
      <Shimmer className="h-3 w-32" />
      <Shimmer className="h-12 w-48 rounded-md" />
      <Shimmer className="h-3 w-24" />
      <Shimmer className="h-12 w-full rounded-md mt-3" />
    </div>
  );
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={"relative overflow-hidden bg-subtle rounded " + (className ?? "")}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-border/40 to-transparent" />
    </div>
  );
}