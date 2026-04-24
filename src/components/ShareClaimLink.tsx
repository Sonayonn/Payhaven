"use client";

import { useState } from "react";

type ShareClaimLinkProps = {
  claimUrl: string;
  amountUsdc: number;
  /** Email or phone the claim was addressed to — for the prefilled message. */
  recipientIdentifier: string;
  recipientKind: "email" | "phone";
  onDone?: () => void;
};

function formatUsdc(n: number): string {
  return n.toFixed(2);
}

/**
 * Build a friendly message to prefill in WhatsApp / SMS.
 * Short, informal, recognizable as a personal message rather than a
 * notification — which matters for Nigerian family dynamics where an
 * automated-looking link is easily dismissed as spam.
 */
function buildShareMessage(claimUrl: string, amount: number): string {
  return (
    `I sent you $${formatUsdc(amount)} USDC on Payhaven — private and secure. ` +
    `Claim it here: ${claimUrl}`
  );
}

export function ShareClaimLink(props: ShareClaimLinkProps) {
  const { claimUrl, amountUsdc, recipientIdentifier, recipientKind, onDone } =
    props;
  const [copied, setCopied] = useState(false);

  const shareMessage = buildShareMessage(claimUrl, amountUsdc);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(claimUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — user can still tap-hold to copy manually.
    }
  }

  // WhatsApp deep link — works on mobile (opens the app) and desktop
  // (opens web.whatsapp.com). Phone-specific variant prefills the "to" number.
  const whatsappHref =
    recipientKind === "phone"
      ? `https://wa.me/${recipientIdentifier.replace(/[^\d]/g, "")}?text=${encodeURIComponent(shareMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  // SMS deep link. iOS uses sms:&body= ; Android uses sms:?body= .
  // The ";?" pattern works on both platforms.
  const smsHref =
    recipientKind === "phone"
      ? `sms:${recipientIdentifier};?&body=${encodeURIComponent(shareMessage)}`
      : `sms:?&body=${encodeURIComponent(shareMessage)}`;

  const mailHref = `mailto:${
    recipientKind === "email" ? recipientIdentifier : ""
  }?subject=${encodeURIComponent(
    `You have $${formatUsdc(amountUsdc)} USDC waiting`,
  )}&body=${encodeURIComponent(shareMessage)}`;

  async function webShare() {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: "Payhaven",
        text: shareMessage,
        url: claimUrl,
      });
    } catch {
      // User canceled share sheet — silent.
    }
  }

  const hasWebShare =
    typeof window !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="flex flex-col gap-4 p-5 bg-green-50 border border-green-200 rounded-xl">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium uppercase tracking-wide text-green-800">
          Sent privately
        </div>
        <div className="text-lg font-semibold text-zinc-900">
          ${formatUsdc(amountUsdc)} USDC ready to claim
        </div>
        <div className="text-sm text-zinc-600">
          Share this link with {recipientKind === "phone" ? "them" : recipientIdentifier}.
          Only someone signed in as this {recipientKind} can claim it.
        </div>
      </div>

      {/* Link preview — tap to copy */}
      <button
        type="button"
        onClick={copyLink}
        className="w-full rounded-lg bg-white border border-zinc-200 hover:border-zinc-300 px-3 py-2.5 text-xs font-mono text-zinc-700 flex items-center justify-between gap-2 active:bg-zinc-50"
      >
        <span className="truncate">{claimUrl}</span>
        <span className="text-[11px] font-sans font-medium text-zinc-600 shrink-0">
          {copied ? "Copied!" : "Tap to copy"}
        </span>
      </button>

      {/* Share options */}
      <div className="flex flex-col gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-3 text-sm font-medium transition-colors"
        >
          <WhatsAppIcon />
          Share via WhatsApp
        </a>
        <a
          href={smsHref}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-3 text-sm font-medium transition-colors"
        >
          <SmsIcon />
          Share via SMS
        </a>

        {hasWebShare && (
          <button
            type="button"
            onClick={webShare}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-900 px-4 py-3 text-sm font-medium transition-colors"
          >
            More share options
          </button>
        )}

        {!hasWebShare && (
          <a
            href={mailHref}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-900 px-4 py-3 text-sm font-medium transition-colors"
          > 
            Share via email
          </a>
        )}
      </div>

      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-zinc-500 underline pt-1 self-center"
        >
          Done — send another
        </button>
      )}
    </div>
  );
}

// ── Inline SVG icons — avoids an icon-library dep for two icons ───────────

function WhatsAppIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
    </svg>
  );
}

function SmsIcon() {
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
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}