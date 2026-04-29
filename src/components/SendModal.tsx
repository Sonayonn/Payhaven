"use client";

import { useEffect, useState } from "react";
import { ComposeSend, type SendResult } from "./ComposeSend";
import { SendProgress } from "./SendProgress";
import { ShareClaimLink } from "./ShareClaimLink";

type View = "compose" | "progress" | "share";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Fires the moment the SDK confirms, page uses this to refresh balances + record history. */
  onSendComplete: (result: SendResult) => void;
};

export function SendModal({ open, onClose, onSendComplete }: Props) {
  const [view, setView] = useState<View>("compose");
  const [result, setResult] = useState<SendResult | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Prevent body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset state every time the modal closes, next open is fresh.
  useEffect(() => {
    if (open) return;
    setView("compose");
    setResult(null);
    setIsComplete(false);
  }, [open]);

  if (!open) return null;

  function handleSendStart() {
    setIsComplete(false);
    setView("progress");
  }

  function handleSendSuccess(r: SendResult) {
    setResult(r);
    setIsComplete(true); // SendProgress will play "Done" then call handleProgressComplete
    onSendComplete(r);   // parent: history + refresh, runs in parallel
  }

  function handleSendError() {
    // ComposeSend is still rendered (just hidden), its internal status now
    // shows the error. We just need to flip the view back so it's visible.
    setView("compose");
    setIsComplete(false);
  }

  function handleProgressComplete() {
    setView("share");
  }

  function requestClose() {
    if (view === "progress") return; // can't close while tx is in flight
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send privately"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in cursor-default"
        tabIndex={-1}
      />

      {/* Container, bottom sheet on mobile, centered card on desktop */}
      <div
        className="
          relative bg-card border border-border
          rounded-t-2xl sm:rounded-2xl
          w-full sm:max-w-md sm:mx-4
          max-h-[92vh] overflow-y-auto
          card-shadow
          animate-slide-up sm:animate-scale-in
        "
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <h2 className="text-base font-semibold text-foreground">
            {view === "compose" && "Send privately"}
            {view === "progress" && "Sending…"}
            {view === "share" && "Sent"}
          </h2>
          {view !== "progress" && (
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="w-8 h-8 -mr-1 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-subtle transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="px-5 pt-5">
          {/* ComposeSend stays mounted across views, error state survives a
              progress→compose flip back. */}
          <div className={view === "compose" ? "block" : "hidden"}>
            <ComposeSend
              onSendStart={handleSendStart}
              onSuccess={handleSendSuccess}
              onSendError={handleSendError}
            />
          </div>

          {view === "progress" && (
            <SendProgress
              isComplete={isComplete}
              onComplete={handleProgressComplete}
            />
          )}

          {view === "share" && result && (
            <ShareClaimLink
              claimUrl={result.claimUrl}
              amountUsdc={result.amountUsdc}
              recipientIdentifier={result.recipientIdentifier}
              recipientKind={result.recipientKind}
              onDone={requestClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}