"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** The target display value, e.g. 0.85 for $0.85 */
  value: number;
  /** Decimal places shown. USDC = 2. */
  decimals?: number;
  /** Animation duration. 800ms per spec 9.4. */
  durationMs?: number;
};

/**
 * Smoothly animates a number from its previous value to its new value.
 * Wraps any balance display so refreshes feel alive instead of jumping.
 *
 * Triggers on every value change. If the value doesn't change between
 * polls, no animation runs. tabular-nums on the parent prevents jitter.
 */
export function NumberRoller({ value, decimals = 2, durationMs = 800 }: Props) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevRef.current === value) return;

    const start = prevRef.current;
    const end = value;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out cubic, slows toward the final value, feels natural
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(start + (end - start) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = end;
        rafRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return <>{displayed.toFixed(decimals)}</>;
}