"use client";

import { Logo } from "@/components/Logo";
import { LandingHeroBackground } from "./LandingHeroBackground";

type Props = {
  onRequestInvite: () => void;
  onHaveCode: () => void;
};

export function LandingHero({ onRequestInvite, onHaveCode }: Props) {
  return (
    <section className="relative w-full overflow-hidden">
      {/* Animated background,subtle, code-generated */}
      <LandingHeroBackground />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-16 sm:pb-24">
        {/* Top nav */}
        <nav className="flex items-center justify-between gap-3 mb-12 sm:mb-20">
          <Logo size={28} variant="lockup" />
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#how-it-works"
              className="hidden sm:inline-block text-sm text-muted hover:text-foreground transition-colors"
            >
              How it works
            </a>
            <button
              onClick={onHaveCode}
              className="text-sm font-semibold px-3 sm:px-4 py-2 rounded-full bg-foreground text-background hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              {/* Mobile: short label. Desktop: full text. */}
              <span className="sm:hidden">Have a code?</span>
              <span className="hidden sm:inline">I have an invite code</span>
            </button>
          </div>
        </nav>

        {/* Hero copy */}
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <BackedByBadge />

          <h1 className="mt-6 text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.05] text-foreground">
            Send to family and friends in seconds.{" "}
            <span className="text-brand">Without a public trail.</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-muted max-w-2xl leading-relaxed">
            USDC remittances to Nigeria. Encrypted on-chain. Recipients claim
            with just a phone number, no wallets, no seed phrases and no
            transaction receipts the world can read.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onRequestInvite}
              className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-brand text-white text-base font-semibold hover:bg-brand-dark transition-all brand-glow active:scale-[0.98] min-h-12"
            >
              Request an invite
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <button
              onClick={onHaveCode}
              className="w-full sm:w-auto px-6 py-3.5 rounded-full border border-border text-foreground text-base font-medium hover:bg-subtle active:scale-[0.98] transition-all min-h-12"
            >
              I have an invite code
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-faint">
            <span className="flex h-2 w-2 rounded-full bg-warning animate-pulse-soft" />
            Private beta · Invite only
          </div>
        </div>

        {/* Hero visual, animated remittance flow */}
        <div className="mt-16 sm:mt-24">
          <RemittanceFlowVisual />
        </div>
      </div>
    </section>
  );
}

// ── Backed-by badge ──────────────────────────────────────────────────────

function BackedByBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card text-xs">
      <span className="text-faint uppercase tracking-wide font-medium">
        Built on
      </span>
      <span className="flex items-center gap-1.5 font-semibold text-foreground">
        <img src="/umbra-logo.png" alt="" className="w-4 h-4 rounded" />
        Umbra
      </span>
    </div>
  );
}

// ── Remittance flow visual, the hero illustration ───────────────────────

function RemittanceFlowVisual() {
  return (
    <div className="relative w-full max-w-4xl mx-auto rounded-2xl border border-border bg-card card-shadow overflow-hidden">
      {/* Top status bar, fake browser chrome to sell the "this is a real product" frame */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-subtle">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-danger/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-warning/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-privacy/40" />
        </div>
        <div className="flex-1 text-center text-xs text-faint font-mono">
          payhaven.app
        </div>
      </div>

      {/* The actual visual: 3 cards showing the remittance flow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
        <FlowStep
          label="Tunde sends"
          location="London 🇬🇧"
          amount="$200"
          subtext="USDC → privately"
          accent="brand"
        />
        <FlowStepArrow />
        <FlowStep
          label="Aunty Chioma receives"
          location="Lagos 🇳🇬"
          amount="$200"
          subtext="Encrypted on-chain"
          accent="privacy"
          locked
        />
      </div>

      {/* Caption bar */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-privacy"
            aria-hidden
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Amounts hidden. Recipient hidden. Senders hidden.</span>
        </div>
        <span className="text-[11px] text-faint font-mono">
          Powered by Umbra · Solana mainnet
        </span>
      </div>
    </div>
  );
}

function FlowStep({
  label,
  location,
  amount,
  subtext,
  accent,
  locked,
}: {
  label: string;
  location: string;
  amount: string;
  subtext: string;
  accent: "brand" | "privacy";
  locked?: boolean;
}) {
  return (
    <div className="bg-card p-6 sm:p-8 flex flex-col gap-2">
      <div className="text-xs font-medium uppercase tracking-wide text-faint">
        {label}
      </div>
      <div className="text-sm text-muted">{location}</div>
      <div className="mt-2 flex items-baseline gap-2">
        {locked && (
          <svg
            width="20"
            height="20"
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
        <span
          className={`balance-number text-3xl sm:text-4xl font-semibold ${accent === "brand" ? "text-foreground" : "text-foreground"}`}
        >
          {amount}
        </span>
      </div>
      <div className="text-xs text-faint">{subtext}</div>
    </div>
  );
}

function FlowStepArrow() {
  return (
    <div className="bg-card p-6 sm:p-8 flex items-center justify-center">
      <div className="relative w-full">
        {/* Animated dotted line + traveling dot */}
        <svg
          className="w-full h-12"
          viewBox="0 0 100 30"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          aria-hidden
        >
          <line
            x1="0"
            y1="15"
            x2="100"
            y2="15"
            stroke="currentColor"
            strokeWidth="0.4"
            strokeDasharray="2 2"
            className="text-border"
          />
          <circle r="1.6" fill="#22D3EE" className="animate-flow-dot">
            <animateMotion
              path="M 0 15 L 100 15"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-2 py-0.5 rounded-full bg-card border border-border text-[10px] uppercase tracking-wide text-muted font-medium">
            ~1s
          </div>
        </div>
      </div>
    </div>
  );
}