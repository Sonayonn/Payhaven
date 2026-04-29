"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { useTheme } from "next-themes";
import { getAccessToken } from "@privy-io/react-auth";

type View = "compose" | "result";

type AuditPackage = {
  granterAddress: string;
  token: string;
  period: string;
  viewingKeys: Record<string, string>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
};

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const YEARS = [2024, 2025, 2026, 2027, 2028];

function defaultMonth() {
  return new Date().getMonth() + 1;
}
function defaultYear() {
  return new Date().getFullYear();
}

export function ViewingKeyGenerateModal({ open, onClose, onGenerated }: Props) {
  const [view, setView] = useState<View>("compose");
  const [startYear, setStartYear] = useState(defaultYear());
  const [startMonth, setStartMonth] = useState(defaultMonth());
  const [endYear, setEndYear] = useState(defaultYear());
  const [endMonth, setEndMonth] = useState(defaultMonth());
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pkg, setPkg] = useState<AuditPackage | null>(null);
  const [monthCount, setMonthCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      setView("compose");
      setStartYear(defaultYear());
      setStartMonth(defaultMonth());
      setEndYear(defaultYear());
      setEndMonth(defaultMonth());
      setLabel("");
      setBusy(false);
      setError(null);
      setPkg(null);
      setMonthCount(0);
      setCopied(false);
    }
  }, [open]);

  if (!open) return null;

  const rangeValid =
    endYear > startYear ||
    (endYear === startYear && endMonth >= startMonth);

  async function handleGenerate() {
    if (!rangeValid) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/viewing-key/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          startYear,
          startMonth,
          endYear,
          endMonth,
          label: label.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok || body.ok !== true) {
        throw new Error(body?.error?.message ?? "Generation failed");
      }
      setPkg(body.auditPackage as AuditPackage);
      setMonthCount(body.monthCount as number);
      setView("result");
      onGenerated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyPackage() {
    if (!pkg) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(pkg, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Generate viewing key"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in cursor-default"
        tabIndex={-1}
      />

      <div
        className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md sm:mx-4 max-h-[92vh] overflow-y-auto card-shadow animate-slide-up sm:animate-scale-in"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <h2 className="text-base font-semibold text-foreground">
            {view === "compose" ? "Share activity records" : "Activity records ready"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 -mr-1 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-subtle transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-5">
          {view === "compose" && (
            <ComposeView
              startYear={startYear}
              setStartYear={setStartYear}
              startMonth={startMonth}
              setStartMonth={setStartMonth}
              endYear={endYear}
              setEndYear={setEndYear}
              endMonth={endMonth}
              setEndMonth={setEndMonth}
              label={label}
              setLabel={setLabel}
              rangeValid={rangeValid}
              busy={busy}
              error={error}
              onGenerate={handleGenerate}
              onCancel={onClose}
            />
          )}

          {view === "result" && pkg && (
            <ResultView
              pkg={pkg}
              monthCount={monthCount}
              copied={copied}
              onCopy={copyPackage}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Compose view ──────────────────────────────────────────────────────────

function ComposeView(props: {
  startYear: number;
  setStartYear: (n: number) => void;
  startMonth: number;
  setStartMonth: (n: number) => void;
  endYear: number;
  setEndYear: (n: number) => void;
  endMonth: number;
  setEndMonth: (n: number) => void;
  label: string;
  setLabel: (s: string) => void;
  rangeValid: boolean;
  busy: boolean;
  error: string | null;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="rounded-md bg-subtle border border-border p-3 text-xs text-muted leading-snug">
        Generate a key your accountant or auditor can use to view your USDC
        activity for a specific time range, and only that range. Send it to
        them like any document.
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-muted">Start</legend>
        <div className="grid grid-cols-2 gap-2">
          <SelectField label="Month" value={props.startMonth} setValue={props.setStartMonth}
            options={MONTHS.map((m) => ({ value: m.value, label: m.label }))} />
          <SelectField label="Year" value={props.startYear} setValue={props.setStartYear}
            options={YEARS.map((y) => ({ value: y, label: String(y) }))} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-muted">End (inclusive)</legend>
        <div className="grid grid-cols-2 gap-2">
          <SelectField label="Month" value={props.endMonth} setValue={props.setEndMonth}
            options={MONTHS.map((m) => ({ value: m.value, label: m.label }))} />
          <SelectField label="Year" value={props.endYear} setValue={props.setEndYear}
            options={YEARS.map((y) => ({ value: y, label: String(y) }))} />
        </div>
      </fieldset>

      {!props.rangeValid && (
        <div className="text-xs text-danger">
          End date must be on or after the start date.
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Label (optional)</span>
        <input
          type="text"
          value={props.label}
          onChange={(e) => props.setLabel(e.target.value)}
          placeholder="e.g., Q2, accountant"
          maxLength={120}
          className="px-3 py-2.5 border border-border rounded-md text-base sm:text-sm bg-background text-foreground min-h-12"
        />
      </label>

      <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted leading-snug">
        Share this only with people you fully trust. Anyone with the file can
        view your USDC activity for the selected range, permanently.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={props.onCancel}
          disabled={props.busy}
          className="min-h-12 rounded-md border border-border text-sm font-semibold text-foreground hover:bg-subtle active:scale-[0.98] transition-all disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={props.onGenerate}
          disabled={!props.rangeValid || props.busy}
          className="min-h-12 rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:bg-subtle disabled:text-faint disabled:cursor-not-allowed brand-glow disabled:shadow-none active:scale-[0.98] transition-all"
        >
          {props.busy ? "Generating…" : "Generate"}
        </button>
      </div>

      {props.error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-xs text-danger/80">
          {props.error}
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  options: { value: number; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-faint">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="px-3 py-2.5 border border-border rounded-md text-base sm:text-sm bg-background text-foreground min-h-12"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// ── Result view ──────────────────────────────────────────────────────────

function ResultView({
  pkg,
  monthCount,
  copied,
  onCopy,
  onClose,
}: {
  pkg: AuditPackage;
  monthCount: number;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  const json = JSON.stringify(pkg);

  useEffect(() => {
    const isDark = resolvedTheme === "dark";
    // QR codes have a max payload around ~2.9KB at error correction L.
    // A 12-month package is ~1.2KB, fits with margin. Anything bigger,
    // we skip the QR and rely on copy-to-clipboard.
    if (json.length > 2500) {
      setQrError(true);
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(json, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: "L",
      color: {
        dark: isDark ? "#F9FAFB" : "#0F172A",
        light: isDark ? "#111827" : "#FAFBFC",
      },
    })
      .then((url) => {
        setQrDataUrl(url);
        setQrError(false);
      })
      .catch(() => setQrError(true));
  }, [json, resolvedTheme]);

  return (
    <div className="flex flex-col gap-4 pb-2 animate-fade-in">
      <div className="rounded-md bg-privacy/5 border border-privacy/30 p-3 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-privacy shrink-0" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span className="text-sm text-foreground">
          {monthCount} month{monthCount === 1 ? "" : "s"} of USDC activity
          unlocked.
        </span>
      </div>

      {qrDataUrl && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="Audit package QR"
            className="h-60 w-60 rounded-md border border-border"
          />
        </div>
      )}

      {qrError && (
        <div className="rounded-md bg-subtle border border-border p-3 text-xs text-muted">
          The package is too large for a QR code, use Copy below.
        </div>
      )}

      <div className="rounded-md border border-border bg-subtle p-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
        <span className="text-[11px] uppercase tracking-wide text-faint">
          Audit package (JSON)
        </span>
        <pre className="text-[11px] font-mono text-foreground leading-relaxed whitespace-pre-wrap break-all">
          {JSON.stringify(pkg, null, 2)}
        </pre>
      </div>

      <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted leading-snug">
        Share this only with people you fully trust. The keys give read access
        to your USDC activity for the selected period, permanently.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onCopy}
          className="min-h-12 rounded-md border border-border text-sm font-semibold text-foreground hover:bg-subtle active:scale-[0.98] transition-all"
        >
          {copied ? "Copied!" : "Copy package"}
        </button>
        <button
          onClick={onClose}
          className="min-h-12 rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark active:scale-[0.98] brand-glow transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
}