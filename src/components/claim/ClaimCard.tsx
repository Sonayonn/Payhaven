"use client";

import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

type Props = {
  children: React.ReactNode;
};

/**
 * Premium-feel shell for every state of the claim page. Replaces the
 * minimal `ClaimShell` with a real header, ambient gradient background,
 * trust signal, and consistent vertical rhythm.
 *
 * Used by every claim-page state, loading, invalid, already-claimed,
 * unauthenticated, wrong-identity, ready, claiming, success, so the
 * recipient experiences a single coherent product.
 */
export function ClaimCard({ children }: Props) {
  return (
    <main className="relative min-h-screen flex flex-col bg-background overflow-hidden">
      {/* Ambient gradient, soft cyan glow at top, fades into background.
          Subtle enough to read as polish, not theme. */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(34, 211, 238, 0.10), transparent 60%)",
        }}
      />

      {/* Subtle grid pattern */}
      <svg
        className="absolute inset-0 -z-10 w-full h-full opacity-[0.035] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <pattern
            id="claim-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M48 0H0V48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#claim-grid)" />
      </svg>

      {/* Top bar, minimal, just the logo + theme. No gear icon (recipient
          isn't a logged-in Payhaven user managing settings). */}
      <header className="w-full border-b border-border/60 bg-card/50 backdrop-blur-md">
        <div className="max-w-md mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Logo size={26} variant="lockup" />
          <ThemeToggle />
        </div>
      </header>

      {/* Card area, vertically centered on tall screens, top-anchored on
          mobile so the keyboard doesn't shove the card off the visible
          area when the user signs in. */}
      <div className="flex-1 w-full flex flex-col items-center justify-start sm:justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-md flex flex-col gap-6">
          {children}
        </div>
      </div>

      {/* Trust signal footer */}
      <footer className="w-full pb-6 sm:pb-8">
        <div className="max-w-md mx-auto px-4 sm:px-6 flex items-center justify-center gap-3 text-[11px] text-faint">
          <span className="flex items-center gap-1.5">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-privacy"
              aria-hidden
            >
              <circle cx="12" cy="12" r="6" />
            </svg>
            <span className="font-medium">Built on Umbra</span>
          </span>
          <span className="text-border">•</span>
          <span>Secured by Solana</span>
        </div>
      </footer>
    </main>
  );
}