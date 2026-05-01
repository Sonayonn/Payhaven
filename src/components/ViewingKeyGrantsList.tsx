"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken, usePrivy } from "@privy-io/react-auth";

type Grant = {
  id: string;
  mintAddress: string;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  label: string | null;
  generatedAt: string;
};

type Props = {
  refreshKey: number;
  onRevoke: () => void;
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatRange(g: Grant): string {
  const start = MONTH_NAMES[g.startMonth - 1] + " " + g.startYear;
  const end = MONTH_NAMES[g.endMonth - 1] + " " + g.endYear;
  if (g.startYear === g.endYear && g.startMonth === g.endMonth) return start;
  return start + ", " + end;
}

function formatGenerated(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ViewingKeyGrantsList({ refreshKey, onRevoke }: Props) {
  const { ready, authenticated } = usePrivy();
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const fetchGrants = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Not signed in");
        return;
      }
      const res = await fetch("/api/viewing-key/list", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "HTTP " + res.status);
      }
      const body = await res.json();
      setGrants(body.grants as Grant[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load grants");
    }
  }, []);

  // Same Privy-readiness guard as useBalances. Settings page mounts this
  // immediately on first auth, without the gate, getAccessToken() returns
  // null, the component flips to "Not signed in" and stays stuck.
  useEffect(() => {
    if (!ready || !authenticated) return;
    fetchGrants();
  }, [fetchGrants, refreshKey, ready, authenticated]);

  async function performRevoke() {
    setRevoking(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/viewing-key/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "HTTP " + res.status);
      }
      setConfirmingRevoke(false);
      onRevoke();
      fetchGrants();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setRevoking(false);
    }
  }

  if (grants === null && !error) return null;

  if (error) {
    return (
      <div className="text-xs text-danger flex flex-col gap-1">
        <span>Couldn&apos;t load grants: {error}</span>
        <button
          onClick={fetchGrants}
          className="text-muted hover:text-foreground underline self-start"
        >
          Retry
        </button>
      </div>
    );
  }

  if (grants && grants.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 pt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">
          Active grants
        </h4>
        <button
          onClick={() => setConfirmingRevoke(true)}
          className="text-xs font-medium text-danger hover:opacity-80 underline"
        >
          Revoke all
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {grants!.map((g) => (
          <div
            key={g.id}
            className="rounded-md border border-border bg-subtle p-3 flex flex-col gap-1"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {formatRange(g)}
              </span>
              <span className="text-[11px] text-faint shrink-0">
                Created {formatGenerated(g.generatedAt)}
              </span>
            </div>
            {g.label && (
              <span className="text-xs text-muted truncate">{g.label}</span>
            )}
            <span className="text-[11px] text-faint">USDC only</span>
          </div>
        ))}
      </div>

      {confirmingRevoke && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 flex flex-col gap-2 mt-2 animate-fade-in">
          <h5 className="text-sm font-semibold text-warning">
            Remove all records?
          </h5>
          <p className="text-xs text-muted leading-snug">
            This removes the grants from your records and your list, useful
            for cleanup. The keys themselves stay valid for anyone who already
            has them.
          </p>
          <p className="text-xs text-muted leading-snug">
            For real on-chain revocation, see <span className="font-semibold text-foreground">Auditor access (coming soon)</span> below.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setConfirmingRevoke(false)}
              disabled={revoking}
              className="min-h-10 rounded-md border border-border text-sm font-medium text-foreground hover:bg-subtle active:scale-[0.98] transition-all disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={performRevoke}
              disabled={revoking}
              className="min-h-10 rounded-md bg-danger text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {revoking ? "Revoking…" : "Revoke all"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}