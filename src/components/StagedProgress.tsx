"use client";

import { useEffect, useRef, useState } from "react";

export type Stage = { id: string; label: string };

type Props = {
  stages: Stage[];
  /** Per-stage advance timestamps in ms. */
  advanceAtMs: number[];
  /** Flips true when the underlying work actually completes. */
  isComplete: boolean;
  /** Called ~800ms after isComplete becomes true. */
  onComplete: () => void;
  doneLabel?: string;
  /** Solana tx signature shown as a "View on Solscan" link in the Done panel. */
  txSignature?: string;
};

export function StagedProgress({
  stages,
  advanceAtMs,
  isComplete,
  onComplete,
  doneLabel = "Done",
  txSignature,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (isComplete) {
      setCurrentIndex(stages.length);
      return;
    }
    const timeouts = advanceAtMs.map((ms, i) =>
      setTimeout(() => setCurrentIndex((cur) => Math.max(cur, i + 1)), ms),
    );
    return () => timeouts.forEach(clearTimeout);
  }, [isComplete, advanceAtMs, stages.length]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (currentIndex !== stages.length) return;
    const t = setTimeout(() => onCompleteRef.current(), 800);
    return () => clearTimeout(t);
  }, [currentIndex, stages.length]);

  const isDone = currentIndex === stages.length;

  return (
    <div className="flex flex-col items-stretch gap-6 py-2">
      <ol className="flex flex-col gap-0">
        {stages.map((stage, i) => {
          const status =
            isDone || i < currentIndex
              ? "complete"
              : i === currentIndex
              ? "active"
              : "pending";
          const isLast = i === stages.length - 1;
          return (
            <li key={stage.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <Indicator status={status} />
                {!isLast && <Connector status={status} />}
              </div>
              <div
                className={`pt-1 pb-5 text-sm transition-colors duration-300 ${
                  status === "active"
                    ? "text-foreground animate-pulse-soft"
                    : status === "complete"
                    ? "text-muted"
                    : "text-faint"
                }`}
              >
                {stage.label}
              </div>
            </li>
          );
        })}
      </ol>

      {isDone && (
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-privacy/15 flex items-center justify-center animate-check-bounce">
            <svg
              width="24"
              height="24"
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
          <div className="text-sm font-semibold text-foreground">{doneLabel}</div>

          {/* Solscan proof, Step 16.1. Visible only while the Done panel is
              up. SendHistory is the primary path for verifying claimed sends
              after the fact; this link is here for the demo video and for
              users who want to confirm immediately. */}
          {txSignature && (
            <a
              href={`https://solscan.io/tx/${txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-foreground font-mono underline transition-colors"
            >
              View on Solscan →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Indicator({ status }: { status: "pending" | "active" | "complete" }) {
  if (status === "complete") {
    return (
      <div className="w-6 h-6 rounded-full bg-privacy flex items-center justify-center animate-check-bounce shrink-0">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white"
          aria-hidden
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-brand flex items-center justify-center shrink-0">
        <div
          className="w-3 h-3 rounded-full border-2 border-brand border-t-transparent animate-spin-slow"
          aria-hidden
        />
      </div>
    );
  }
  return <div className="w-6 h-6 rounded-full border-2 border-border shrink-0" />;
}

function Connector({ status }: { status: "pending" | "active" | "complete" }) {
  return (
    <div
      className={`w-0.5 flex-1 min-h-6 transition-colors duration-300 ${
        status === "complete" ? "bg-privacy" : "bg-border"
      }`}
    />
  );
}