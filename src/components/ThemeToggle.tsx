"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Theme toggle button, shows current mode's icon, swaps on click.
 *
 * - Sun icon visible in dark mode (click → go to light)
 * - Moon icon visible in light mode (click → go to dark)
 * - System mode falls through to whichever the OS reports (resolvedTheme)
 *
 * The `mounted` guard prevents hydration mismatch, next-themes can't know
 * the theme until after the first client render. Showing a placeholder
 * div with the same dimensions prevents layout shift.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-9 h-9" aria-hidden />;
  }

  const current = resolvedTheme ?? theme;
  const next = current === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-subtle transition-colors text-foreground"
      aria-label={`Switch to ${next} mode`}
    >
      {current === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M5 5l1.5 1.5M17.5 17.5L19 19M2 12h2M20 12h2M5 19l1.5-1.5M17.5 6.5L19 5" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}