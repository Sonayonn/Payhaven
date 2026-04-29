"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getAccessToken } from "@privy-io/react-auth";

type Row = {
  token: string;
  redactedRecipient: string;
  amountUsdcBaseUnits: string;
  status: "pending" | "claimed" | "expired";
  createdAt: string;
  claimedAt: string | null;
  createUtxoSignature: string;
  claimedTxSignature: string | null;
  claimUrl: string;
};

// Re-export for compatibility with any existing import sites; the in-memory
// SendRecord shape is gone but page.tsx no longer references it either.
export type SendRecord = Row;

type Props = {
  /** Bumped by parent after every successful send to trigger a refetch. */
  refreshKey: number;
  /** Optional: notified after each fetch with the row count. Used by
   *  PrivacyTimeline to know whether the user has sent privately. */
  onCountChange?: (count: number) => void;
};

function formatUsdc(baseUnits: string): string {
  const n = Number(baseUnits) / 1_000_000;
  return n.toFixed(2);
}

/**
 * Relative time: "just now", "3m ago", "2h ago", "yesterday", or a date.
 * Tuned for a single-column history list; we want short labels, not precise ones.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function SendHistory({ refreshKey, onCountChange }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Not signed in");
        return;
      }
      const res = await fetch("/api/send-history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const body = await res.json();
      setRows(body.rows as Row[]);
      onCountChange?.(body.rows.length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    }
  }, []);

  // Initial fetch + refetch whenever the parent bumps refreshKey.
  useEffect(() => {
    fetchRows();
  }, [fetchRows, refreshKey]);

  // Loading: show nothing on first paint to avoid CLS, this section sits
  // below the dashboard, doesn't need a skeleton block. After fetch, render
  // either the empty state or the list.
  if (rows === null && !error) return null;

  if (error) {
    return (
      <div className="w-full border-t border-border pt-6 flex flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">Recent sends</h2>
        <div className="text-sm text-danger">Couldn&apos;t load history.</div>
        <button
          onClick={fetchRows}
          className="text-xs text-muted hover:text-foreground underline self-start"
        >
          Retry
        </button>
      </div>
    );
  }

  if (rows && rows.length === 0) {
    return (
      <div className="w-full border-t border-border pt-6 flex flex-col gap-1.5">
        <h2 className="text-base font-semibold text-foreground">Recent sends</h2>
        <p className="text-sm text-muted">
          No sends yet. Your private sends will show up here, encrypted
          on-chain, visible only to you.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full border-t border-border pt-6 flex flex-col gap-3">
      <h2 className="text-base font-semibold text-foreground">Recent sends</h2>
      <div className="flex flex-col gap-2">
        {rows!.map((r) => (
          <SendRow key={r.token} row={r} />
        ))}
      </div>
    </div>
  );
}

// ── Per-row component ─────────────────────────────────────────────────────

function SendRow({ row }: { row: Row }) {
  const [shareOpen, setShareOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Tap-outside to dismiss share menu
  useEffect(() => {
    if (!shareOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setShareOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [shareOpen]);

  const amount = formatUsdc(row.amountUsdcBaseUnits);

  return (
    <div className="p-3 border border-border bg-card rounded-md flex flex-col gap-1.5 card-shadow">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-foreground balance-number">
          ${amount}
        </span>
        <span className="text-xs text-faint shrink-0">
          {relativeTime(row.createdAt)}
        </span>
      </div>

      <div className="text-xs text-muted truncate">
        to {row.redactedRecipient}
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <StatusBadge status={row.status} claimedAt={row.claimedAt} />

        {row.status === "pending" && (
          <ShareMenu
            row={row}
            open={shareOpen}
            setOpen={setShareOpen}
            menuRef={menuRef}
          />
        )}

        {row.status === "claimed" && row.claimedTxSignature && (
          <a
            href={`https://solscan.io/tx/${row.claimedTxSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted hover:text-foreground underline"
          >
            Solscan ↗
          </a>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  claimedAt,
}: {
  status: Row["status"];
  claimedAt: string | null;
}) {
  if (status === "claimed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-privacy">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Claimed{claimedAt ? ` ${relativeTime(claimedAt)}` : ""}
      </span>
    );
  }
  if (status === "expired") {
    return <span className="text-xs text-warning">Expired</span>;
  }
  return <span className="text-xs text-muted">Pending</span>;
}

// ── Inline share menu ─────────────────────────────────────────────────────

function ShareMenu({
  row,
  open,
  setOpen,
  menuRef,
}: {
  row: Row;
  open: boolean;
  setOpen: (v: boolean) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [copied, setCopied] = useState(false);
  const amount = formatUsdc(row.amountUsdcBaseUnits);

  // Same message shape as ShareClaimLink.tsx, keep these aligned.
  const message =
    "I sent you $" + amount + " USDC privately on Payhaven. " +
    "Claim it here: " + row.claimUrl + ". " +
    "(Stays private, no one but you can see the amount.)";

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const smsHref = `sms:?&body=${encodeURIComponent(message)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(row.claimUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1500);
    } catch {
      // Clipboard blocked, leave menu open, user can long-press the link.
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs font-medium text-brand hover:text-brand-dark transition-colors"
      >
        Re-share link
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-full mb-1 z-50 w-44 rounded-md border border-border bg-card flex flex-col py-1 animate-fade-in"
          style={{ boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)" }}
        >
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className="px-3 py-2 text-sm text-foreground hover:bg-subtle text-left"
            onClick={() => setOpen(false)}
          >
            WhatsApp
          </a>
          <a
            href={smsHref}
            role="menuitem"
            className="px-3 py-2 text-sm text-foreground hover:bg-subtle text-left"
            onClick={() => setOpen(false)}
          >
            SMS
          </a>
          <button
            type="button"
            onClick={copyLink}
            role="menuitem"
            className="px-3 py-2 text-sm text-foreground hover:bg-subtle text-left"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}