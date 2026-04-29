"use client";

import { useState, useEffect, useRef } from "react";

type Props = {
  /** Tooltip body. Keep to 1-2 sentences per spec 15.2. */
  content: string;
  /** Visually-hidden label for screen readers, e.g. "About public balance". */
  label: string;
  /** Optional alignment override. Default: right-aligned, opens leftward. */
  align?: "left" | "right";
};

/**
 * Compact (?) icon that opens a small popover with explanatory text.
 * Hover-OR-tap on desktop; tap-only on mobile (no hover support).
 *
 * Accessibility: button has `aria-expanded` and `aria-controls`; the popover
 * has `role="tooltip"` and is referenced by id. Tap-outside or Escape dismisses.
 */
export function InfoTooltip({ content, label, align = "right" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Stable id for aria-controls. useState init runs once per component instance.
  const [tooltipId] = useState(
    () => `tt-${Math.random().toString(36).slice(2, 10)}`,
  );

  useEffect(() => {
    if (!open) return;

    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-expanded={open}
        aria-controls={tooltipId}
        aria-label={label}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-faint hover:text-muted transition-colors cursor-help shrink-0"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`
            absolute top-full mt-2 z-30
            w-56 sm:w-64
            rounded-md border border-border bg-card card-shadow
            p-3 text-xs text-muted leading-snug
            animate-fade-in
            ${align === "right" ? "right-0" : "left-0"}
          `}
        >
          {content}
        </span>
      )}
    </span>
  );
}