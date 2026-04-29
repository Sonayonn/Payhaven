"use client";

import { redactIdentifier } from "@/lib/format/identifiers";

type Props = {
  /** Raw, validated identifier, email or phone. */
  identifier: string;
  kind: "email" | "phone";
  amount: number;
};

/**
 * Confirmation block shown above the Send button. Reuses the same redaction
 * logic the recipient sees on /claim, so the sender knows exactly what shape
 * of identifier the recipient must log in with.
 *
 * Per spec 13: "Sending $X to [redacted]. This person needs to log in with
 * this exact email to claim. They cannot transfer the claim to another address."
 */
export function RecipientPreview({ identifier, kind, amount }: Props) {
  const redacted = redactIdentifier(identifier);
  const noun = kind === "email" ? "email" : "phone number";

  return (
    <div className="rounded-md bg-subtle border border-border p-3 flex flex-col gap-1.5 animate-fade-in">
      <div className="text-xs uppercase tracking-wide text-faint">
        Sending privately
      </div>
      <div className="text-sm text-foreground">
        <span className="font-semibold">${amount.toFixed(2)} USDC</span>
        <span className="text-muted"> to </span>
        <span className="font-mono font-semibold">{redacted}</span>
      </div>
      <div className="text-xs text-muted leading-snug">
        Only someone signed in with this detail can claim. The link can&apos;t
        be transferred.
      </div>
    </div>
  );
}