"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { buildRequestInviteUrl } from "@/lib/whatsapp";

type View = "compose" | "checking" | "logging-in" | "claiming" | "error";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function InviteCodeModal({ open, onClose }: Props) {
  const { ready, authenticated, login } = usePrivy();

  const [view, setView] = useState<View>("compose");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Stash the code across the Privy login redirect so we can claim it
  // when the user returns authenticated. Privy's login is in-page (not
  // a redirect for embedded wallets) but we keep the code in state too.
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setView("compose");
      setCode("");
      setError(null);
      setPendingCode(null);
    }
  }, [open]);

  // After Privy login completes, claim the pending invite code.
  const claimAfterLogin = useCallback(async (codeToClaim: string) => {
    setView("claiming");
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication failed");
      const res = await fetch("/api/invite/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ code: codeToClaim }),
      });
      const body = await res.json();
      if (!res.ok || body.ok !== true) {
        throw new Error(body?.error?.message ?? "Couldn't claim invite");
      }
      // Success  close the modal and let the parent re-render. The
      // dashboard router will pick up the authenticated state and swap
      // out the landing page.
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't claim invite");
      setView("error");
    }
  }, [onClose]);

  // Watch for the post-login moment: if we have a pending code AND the user
  // just authenticated, fire the claim. This handles the async nature of
  // Privy's login resolving after our event handler returns.
  useEffect(() => {
    if (
      ready &&
      authenticated &&
      pendingCode &&
      view === "logging-in"
    ) {
      claimAfterLogin(pendingCode);
    }
  }, [ready, authenticated, pendingCode, view, claimAfterLogin]);

  if (!open) return null;

  const trimmed = code.trim().toUpperCase();
  const codeLooksValid = trimmed.length >= 3;

  async function handleSubmit() {
    if (!codeLooksValid) return;
    setError(null);
    setView("checking");
    try {
      const res = await fetch("/api/invite/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "Couldn't verify code");
      }
      if (!body.exists) {
        setError(
          "We don't recognize that code. Double-check it, or request a fresh one.",
        );
        setView("compose");
        return;
      }
      // Code precheck passed. Trigger Privy login.
      setPendingCode(trimmed);
      setView("logging-in");
      // If already authenticated (e.g., session cookie still valid),
      // skip Privy and go straight to claim.
      if (authenticated) {
        await claimAfterLogin(trimmed);
      } else {
        login();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't verify code");
      setView("compose");
    }
  }

  function requestClose() {
    if (view === "claiming" || view === "logging-in" || view === "checking") {
      return;
    }
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enter invite code"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in cursor-default"
        tabIndex={-1}
      />

      <div
        className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md sm:mx-4 max-h-[92vh] overflow-y-auto card-shadow animate-slide-up sm:animate-scale-in"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <h2 className="text-base font-semibold text-foreground">
            {view === "checking" && "Checking your code…"}
            {view === "logging-in" && "Signing you in…"}
            {view === "claiming" && "Activating your account…"}
            {(view === "compose" || view === "error") && "Enter your invite code"}
          </h2>
          {(view === "compose" || view === "error") && (
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="w-8 h-8 -mr-1 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-subtle transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="px-5 pt-5 pb-2">
          {(view === "compose" || view === "error") && (
            <ComposeView
              code={code}
              setCode={setCode}
              codeLooksValid={codeLooksValid}
              error={error}
              onSubmit={handleSubmit}
            />
          )}

          {(view === "checking" ||
            view === "logging-in" ||
            view === "claiming") && (
            <ProgressView
              label={
                view === "checking"
                  ? "Verifying your code"
                  : view === "logging-in"
                    ? "Open the popup to sign in"
                    : "Activating your account"
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ComposeView({
  code,
  setCode,
  codeLooksValid,
  error,
  onSubmit,
}: {
  code: string;
  setCode: (v: string) => void;
  codeLooksValid: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="rounded-md bg-subtle border border-border p-3 text-xs text-muted leading-snug">
        Payhaven is invite-only during private beta. Enter the code we shared
        with you to unlock access.
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Invite code</span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          placeholder="BETA-2026-XXX"
          autoFocus
          className="px-3 py-2.5 border border-border rounded-md text-base sm:text-sm bg-background text-foreground min-h-12 font-mono uppercase tracking-wide"
        />
      </label>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
          {error}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={!codeLooksValid}
        className="min-h-12 rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:bg-subtle disabled:text-faint disabled:cursor-not-allowed brand-glow disabled:shadow-none active:scale-[0.98] transition-all"
      >
        Continue
      </button>

      <div className="text-center pt-2">
        <a
          href={buildRequestInviteUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted hover:text-foreground underline"
        >
          Don&apos;t have a code? Request one →
        </a>
      </div>
    </div>
  );
}

function ProgressView({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
      <div className="w-10 h-10 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      <div className="text-sm text-muted text-center">{label}…</div>
    </div>
  );
}