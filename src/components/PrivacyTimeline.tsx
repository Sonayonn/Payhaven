"use client";

import { useState } from "react";

type StepStatus = "complete" | "active" | "pending" | "inactive";

type Step = {
  id: string;
  icon: "globe" | "lock" | "warning";
  label: string;
  visibility: string;
  tooltip: string;
  status: StepStatus;
};

type Props = {
  /** True if user has any USDC, public OR private. */
  hasFunded: boolean;
  /** True if encrypted balance > 0 right now. */
  hasPrivateBalance: boolean;
  /** True if at least one row exists in send history. */
  hasSentPrivately: boolean;
  /** Session-only: set when user completes an unshield this session. */
  hasUnshieldedRecently: boolean;
  /** Session-only: set when user reaches the Cash Out outcome screen. */
  hasInitiatedCashOut: boolean;
};

function buildSteps({
  hasFunded,
  hasPrivateBalance,
  hasSentPrivately,
  hasUnshieldedRecently,
  hasInitiatedCashOut,
}: Props): Step[] {
  const steps: Step[] = [
    {
      id: "fund",
      icon: "globe",
      label: "Funded from Solana",
      visibility: "Visible on-chain",
      tooltip:
        "USDC arrived at your Payhaven address. The deposit is visible on Solscan, that's normal, like buying anything on a public blockchain.",
      status: hasFunded ? "complete" : "pending",
    },
    {
      id: "shield",
      icon: "lock",
      label: "Held privately",
      visibility: "Encrypted on-chain",
      tooltip:
        "Your private balance is encrypted on Solana. The amount and your account state are hidden from outside observers, only you can decrypt it.",
      status: hasPrivateBalance
        ? "complete"
        : hasFunded
        ? "active"
        : "pending",
    },
    {
      id: "send",
      icon: "lock",
      label: "Sent privately",
      visibility: "Encrypted on-chain",
      tooltip:
        "Each private send creates an encrypted UTXO. The recipient, amount, and your account changes are all hidden. The on-chain footprint is just 'you interacted with Umbra.'",
      status: hasSentPrivately
        ? "complete"
        : hasPrivateBalance
        ? "active"
        : "pending",
    },
  ];

  if (hasUnshieldedRecently || hasInitiatedCashOut) {
    steps.push({
      id: "unshield",
      icon: "warning",
      label: "Unshielded for off-ramp",
      visibility: "Visible on-chain",
      tooltip:
        "When you unshield, the specific amount becomes visible on Solscan. This is the moment privacy ends for that money, necessary to convert to Naira via partners who don't yet support shielded settlement.",
      status: hasUnshieldedRecently ? "complete" : "active",
    });
  }

  if (hasInitiatedCashOut) {
    steps.push({
      id: "offramp",
      icon: "globe",
      label: "Off-ramped to Naira",
      visibility: "Off-chain settlement",
      tooltip:
        "Naira withdrawals settle through regulated off-ramp partners. Payhaven batches transactions so individual recipients aren't exposed to the partner, even at this final step, your privacy is protected.",
      status: "active",
    });
  }

  return steps;
}

export function PrivacyTimeline(props: Props) {
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const steps = buildSteps(props);

  // Mobile: collapsed by default, tap header to expand. Desktop: always shown.
  // We render the same DOM and just toggle `hidden sm:block` on the body.

  return (
    <div className="rounded-md border border-border bg-card flex flex-col">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between p-3 text-left sm:cursor-default"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-privacy"
            aria-hidden
          >
            <path d="M9 12l2 2 4-4" />
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            Your privacy footprint
          </span>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-faint transition-transform sm:hidden ${
            collapsed ? "" : "rotate-180"
          }`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div className={`px-3 pb-3 ${collapsed ? "hidden" : "block"} sm:block`}>
        <ol className="flex flex-col gap-0">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const isOpen = openTooltip === step.id;
            return (
              <li key={step.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <StepIcon icon={step.icon} status={step.status} />
                  {!isLast && <Connector status={step.status} />}
                </div>
                <div className="flex-1 pb-3">
                  <button
                    type="button"
                    onClick={() => setOpenTooltip(isOpen ? null : step.id)}
                    className="w-full text-left flex flex-col gap-0.5 min-h-11 py-1 group"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-medium transition-colors ${
                          step.status === "active"
                            ? "text-foreground"
                            : step.status === "complete"
                            ? "text-foreground"
                            : "text-faint"
                        }`}
                      >
                        {step.label}
                      </span>
                      <VisibilityBadge
                        text={step.visibility}
                        status={step.status}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-1 rounded-md bg-subtle border border-border p-3 text-xs text-muted animate-fade-in">
                      {step.tooltip}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// ── Step icon ─────────────────────────────────────────────────────────────

function StepIcon({
  icon,
  status,
}: {
  icon: "globe" | "lock" | "warning";
  status: StepStatus;
}) {
  // Color logic: complete = privacy-green for lock states, foreground for
  // globe/warning to keep the "encrypted = green" association sacred.
  // pending = faint borders, active = brand cyan.
  const iconColor =
    status === "pending"
      ? "text-faint"
      : icon === "lock"
      ? "text-privacy"
      : icon === "warning"
      ? "text-warning"
      : "text-muted";

  const ringColor =
    status === "active"
      ? "border-brand"
      : status === "complete"
      ? icon === "warning"
        ? "border-warning/40"
        : "border-privacy/40"
      : "border-border";

  return (
    <div
      className={`w-7 h-7 rounded-full border-2 ${ringColor} flex items-center justify-center shrink-0 bg-card transition-colors`}
    >
      {icon === "globe" && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconColor}
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )}
      {icon === "lock" && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconColor}
          aria-hidden
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )}
      {icon === "warning" && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconColor}
          aria-hidden
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )}
    </div>
  );
}

// ── Connector line ────────────────────────────────────────────────────────

function Connector({ status }: { status: StepStatus }) {
  return (
    <div
      className={`w-0.5 flex-1 min-h-4 transition-colors ${
        status === "complete" ? "bg-privacy/40" : "bg-border"
      }`}
    />
  );
}

// ── Visibility badge ──────────────────────────────────────────────────────

function VisibilityBadge({
  text,
  status,
}: {
  text: string;
  status: StepStatus;
}) {
  // Color the badge by what it says, not by step status. "Encrypted on-chain"
  // is always privacy-green even if the step is pending, it's an intrinsic
  // property of that step, not a state.
  const colorClass = text.startsWith("Encrypted")
    ? "border-privacy/30 text-privacy bg-privacy/5"
    : text.startsWith("Visible")
    ? "border-warning/30 text-warning bg-warning/5"
    : "border-border text-muted bg-subtle";

  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${colorClass} font-medium shrink-0 ${
        status === "pending" ? "opacity-50" : ""
      }`}
    >
      {text}
    </span>
  );
}