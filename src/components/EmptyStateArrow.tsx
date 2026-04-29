"use client";

/**
 * Animated arrow that points down toward the funding address card. Used by
 * the Public-tab empty state (Step 14.1). Bounces gently to draw the eye
 * without being noisy.
 *
 * Respects prefers-reduced-motion via the underlying CSS (no JS animation).
 */
export function EmptyStateArrow() {
  return (
    <div className="flex justify-center" aria-hidden>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand animate-arrow-bounce"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </svg>
    </div>
  );
}