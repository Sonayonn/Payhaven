"use client";

import Link from "next/link";

export function SettingsHeader({ title }: { title: string }) {
  return (
    <div className="w-full max-w-md flex items-center gap-3 mb-2">
      <Link
        href="/"
        aria-label="Back to dashboard"
        className="w-10 h-10 -ml-2 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-subtle transition-colors"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </Link>
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
    </div>
  );
}