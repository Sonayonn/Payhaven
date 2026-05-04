"use client";

import { useEffect, useState, useRef } from "react";

type StepId = "fund" | "shield" | "send" | "receive";

const STEPS: {
  id: StepId;
  number: string;
  title: string;
  body: string;
}[] = [
  {
    id: "fund",
    number: "1",
    title: "Fund your Payhaven",
    body: "Send USDC from any Solana wallet to your Payhaven address. Like depositing to a bank account, but on-chain.",
  },
  {
    id: "shield",
    number: "2",
    title: "Shield it private",
    body: "Tap Shield. USDC moves into Umbra's encrypted pool. After this, your balance is invisible to everyone except you.",
  },
  {
    id: "send",
    number: "3",
    title: "Send privately",
    body: "Enter their phone or email. Hit send. The transfer is encrypted on-chain — amount, recipient, all hidden.",
  },
  {
    id: "receive",
    number: "4",
    title: "They claim, also private",
    body: "They get a WhatsApp link. Tap, sign in with email — no wallets, no seed phrases. Money lands in their private balance, to withdraw, cashout or send privately",
  },
];

const AUTO_ADVANCE_MS = 5000;

export function InteractiveDemo() {
  const [activeStep, setActiveStep] = useState<StepId>("fund");
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-advance through steps, pause if user clicks
  useEffect(() => {
    if (paused) return;

    intervalRef.current = setInterval(() => {
      setActiveStep((current) => {
        const idx = STEPS.findIndex((s) => s.id === current);
        return STEPS[(idx + 1) % STEPS.length].id;
      });
    }, AUTO_ADVANCE_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused]);

  function handleStepClick(id: StepId) {
    setActiveStep(id);
    setPaused(true);
    // Resume auto-advance after 15s of inactivity
    setTimeout(() => setPaused(false), 15_000);
  }

  return (
    <section className="w-full py-20 sm:py-32 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-12 sm:mb-16">
          <div className="text-xs font-medium uppercase tracking-wider text-brand mb-3">
            See it work
          </div>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-foreground leading-tight">
            From funded to private, in four taps.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
            The actual Payhaven flow — experience the magic, in four steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
          {/* Left: phone mockup */}
          <div className="md:col-span-6 flex justify-center">
            <PhoneMockup activeStep={activeStep} />
          </div>

          {/* Right: steps */}
          <div className="md:col-span-6 flex flex-col gap-3">
            {STEPS.map((step) => (
              <StepCard
                key={step.id}
                step={step}
                isActive={activeStep === step.id}
                onClick={() => handleStepClick(step.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Step card ────────────────────────────────────────────────────────────

function StepCard({
  step,
  isActive,
  onClick,
}: {
  step: (typeof STEPS)[number];
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
        isActive
          ? "border-brand bg-card card-shadow"
          : "border-transparent bg-card/40 hover:border-border"
      }`}
      aria-current={isActive ? "step" : undefined}
    >
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
            isActive
              ? "bg-brand text-white"
              : "bg-subtle text-muted"
          }`}
        >
          {step.number}
        </div>
        <div className="flex-1">
          <h3
            className={`text-lg font-semibold transition-colors ${
              isActive ? "text-foreground" : "text-muted"
            }`}
          >
            {step.title}
          </h3>
          <p
            className={`mt-1 text-sm leading-relaxed transition-opacity ${
              isActive ? "text-muted opacity-100" : "text-faint opacity-60"
            }`}
          >
            {step.body}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── Phone mockup ─────────────────────────────────────────────────────────

function PhoneMockup({ activeStep }: { activeStep: StepId }) {
  return (
    <div className="relative w-72.5 sm:w-[320px]">
      {/* Phone frame */}
      <div className="relative aspect-9/19.5 rounded-[3rem] bg-foreground p-3 shadow-2xl">
        {/* Inner screen */}
        <div className="relative w-full h-full rounded-[2.25rem] overflow-hidden bg-background">
          {/* Status bar — fake */}
          <div className="absolute top-0 left-0 right-0 h-7 flex items-center justify-between px-6 z-10 text-[10px] font-semibold text-foreground">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span>●●●</span>
              <span>📶</span>
              <span>🔋</span>
            </div>
          </div>

          {/* Notch */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-foreground rounded-b-2xl z-20" />

          {/* Screen content — switches based on active step */}
          <div className="absolute inset-0 pt-9">
            <ScreenContent activeStep={activeStep} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Screen content for each step ─────────────────────────────────────────

function ScreenContent({ activeStep }: { activeStep: StepId }) {
  if (activeStep === "fund") return <FundScreen />;
  if (activeStep === "shield") return <ShieldScreen />;
  if (activeStep === "send") return <SendScreen />;
  return <ReceiveScreen />;
}

// Fund: Public tab showing $200 just arrived
function FundScreen() {
  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <ScreenHeader title="Payhaven" />
      <Tabs active="public" />
      <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
        Public Balance
      </div>
      <div className="flex items-baseline gap-1.5 transition-all duration-500">
        <span className="text-4xl font-semibold text-foreground">$200.00</span>
        <span className="text-xs text-muted">USDC</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="rounded-md bg-brand text-white text-xs font-semibold py-2.5 text-center brand-glow">
          Shield
        </div>
        <div className="rounded-md border border-border text-foreground text-xs font-semibold py-2.5 text-center">
          Cash Out
        </div>
      </div>
      <div className="mt-2 rounded-md bg-warning/10 border border-warning/30 p-2.5">
        <div className="text-[11px] font-semibold text-warning">
          Just received $200
        </div>
        <div className="text-[10px] text-warning/80 mt-0.5">
          From Phantom · Visible on Solscan
        </div>
      </div>
    </div>
  );
}

// Shield: modal mid-action, animation
function ShieldScreen() {
  return (
    <div className="h-full flex flex-col p-4 gap-3 relative">
      <ScreenHeader title="Payhaven" />
      <Tabs active="public" />
      <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
        Public Balance
      </div>
      <div className="text-4xl font-semibold text-foreground opacity-50">
        $200.00
      </div>

      {/* Shield modal overlay */}
      <div className="absolute inset-x-3 bottom-3 rounded-xl bg-card border border-border p-4 shadow-xl animate-in slide-in-from-bottom-4 duration-500">
        <div className="text-sm font-semibold text-foreground mb-2">
          Shielding $200...
        </div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2 text-privacy">
            <Checkmark /> <span>Generating proof</span>
          </div>
          <div className="flex items-center gap-2 text-privacy">
            <Checkmark /> <span>Submitting to Umbra</span>
          </div>
          <div className="flex items-center gap-2 text-brand">
            <Spinner /> <span>Confirming on Solana...</span>
          </div>
        </div>
        <div className="mt-3 h-1 rounded-full bg-subtle overflow-hidden">
          <div className="h-full w-2/3 bg-brand brand-glow" />
        </div>
      </div>
    </div>
  );
}

// Send: form filled in, ready to submit
function SendScreen() {
  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <ScreenHeader title="Payhaven" />
      <Tabs active="private" />
      <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
        Private Balance
      </div>
      <div className="flex items-center gap-2">
        <LockSmall />
        <span className="text-4xl font-semibold text-foreground">$200.00</span>
      </div>

      {/* Send composer */}
      <div className="rounded-xl bg-subtle p-3 mt-2 space-y-2 transition-all duration-500">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-faint font-medium mb-1">
            To
          </div>
          <div className="text-xs font-mono text-foreground bg-card rounded px-2 py-1.5 border border-border">
            chioma***@gmail.com
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-faint font-medium mb-1">
            Amount
          </div>
          <div className="text-base font-semibold text-foreground bg-card rounded px-2 py-1.5 border border-border">
            $50.00
          </div>
        </div>
        <div className="rounded-md bg-brand text-white text-xs font-semibold py-2 text-center brand-glow">
          Send privately
        </div>
      </div>
    </div>
  );
}

// Receive: claim page
function ReceiveScreen() {
  return (
    <div className="h-full flex flex-col p-4 gap-3 items-center text-center">
      <div className="mt-2">
        <BrandMark />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-faint mt-2">
        For chioma***@gmail.com
      </div>
      <div className="text-base font-semibold text-foreground mt-1">
        You have $50 USDC waiting
      </div>
      <div className="text-[11px] text-muted leading-snug px-2">
        Sent privately. Only you can claim it. Sign in to your Payhaven account.
      </div>
      <div className="mt-2 w-full rounded-md bg-brand text-white text-xs font-semibold py-2.5 brand-glow">
        Claim $50
      </div>
      <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-privacy/10 border border-privacy/30">
        <LockSmall />
        <span className="text-[10px] font-semibold text-privacy">
          Encrypted on-chain
        </span>
      </div>
    </div>
  );
}

// ── Reusable bits ────────────────────────────────────────────────────────

function ScreenHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <BrandMarkSmall />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="w-5 h-5 rounded-full bg-subtle" />
    </div>
  );
}

function Tabs({ active }: { active: "public" | "private" }) {
  return (
    <div className="grid grid-cols-2 border-b border-border">
      <div
        className={`text-center text-xs font-medium py-2 ${
          active === "public" ? "text-foreground" : "text-muted"
        }`}
      >
        Public
        {active === "public" && (
          <div className="h-0.5 bg-brand mt-2 -mb-px" />
        )}
      </div>
      <div
        className={`text-center text-xs font-medium py-2 ${
          active === "private" ? "text-foreground" : "text-muted"
        }`}
      >
        🔒 Private
        {active === "private" && (
          <div className="h-0.5 bg-brand mt-2 -mb-px" />
        )}
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 40 40" fill="none" aria-hidden>
      <g transform="rotate(-8 14 14)">
        <rect x="4" y="4" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.45" />
      </g>
      <rect x="14" y="14" width="22" height="22" rx="6" fill="#22D3EE" />
    </svg>
  );
}

function BrandMarkSmall() {
  return (
    <svg width="18" height="18" viewBox="0 0 40 40" fill="none" aria-hidden>
      <g transform="rotate(-8 14 14)">
        <rect x="4" y="4" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.45" />
      </g>
      <rect x="14" y="14" width="22" height="22" rx="6" fill="#22D3EE" />
    </svg>
  );
}

function LockSmall() {
  return (
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
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function Checkmark() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}