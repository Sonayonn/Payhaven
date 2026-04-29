"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";

type Props = {
  amount: string;
  txSignature?: string;
};

export function ClaimSuccess({ amount, txSignature }: Props) {
  const router = useRouter();

  useEffect(() => {
    // Single tasteful burst from mid-screen. ~80 particles, 2s decay.
    // disableForReducedMotion respects the user's accessibility setting.
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.5 },
      startVelocity: 35,
      gravity: 0.9,
      ticks: 200,
      colors: ["#22D3EE", "#10B981", "#67E8F9", "#34D399"],
      disableForReducedMotion: true,
    });
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-6 animate-fade-in">
      {/* Hero */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <div className="w-16 h-16 rounded-full bg-privacy/15 flex items-center justify-center animate-check-bounce">
          <svg
            width="32"
            height="32"
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
        </div>
        <h1 className="text-xl font-semibold text-foreground text-center pt-2">
          ${amount} USDC claimed
        </h1>
        <p className="text-sm text-muted text-center max-w-sm">
          It&apos;s now in your private Payhaven balance, encrypted on-chain,
          visible only to you.
        </p>
      </div>

      {/* CTAs */}
      <div className="w-full flex flex-col gap-2">
        <button
          onClick={() => router.push("/")}
          className="min-h-12 w-full rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark active:scale-[0.98] brand-glow transition-all"
        >
          Go to your Payhaven account
        </button>
        <button
          onClick={() => router.push("/?tab=private&action=send")}
          className="min-h-12 w-full rounded-md border border-border text-foreground text-sm font-semibold hover:bg-subtle active:scale-[0.98] transition-all"
        >
          Send to someone else
        </button>
      </div>

      {/* Solscan proof, Step 16 makes this universal; foreshadowing it here. */}
      {txSignature && (
        <a
          href={`https://solscan.io/tx/${txSignature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted hover:text-foreground font-mono underline self-center"
        >
          View on Solscan →
        </a>
      )}
    </div>
  );
}