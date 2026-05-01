"use client";

export function Compliance() {
  return (
    <section className="w-full py-20 sm:py-32 bg-subtle/30 border-y border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-14 sm:mb-20">
          <div className="text-xs font-medium uppercase tracking-wider text-privacy mb-3">
            Compliance
          </div>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-foreground leading-tight">
            Privacy you can prove. On your terms.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
            Privacy doesn&apos;t mean opacity. Payhaven gives you cryptographic
            tools to share specific activity with the people who need to see
            it and nobody else.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ComplianceCard
            tag="For accountants & auditors"
            title="Share activity records"
            description="Generate a viewing key that lets your accountant see your USDC activity for a specific time range — and only that range. Hand it over like any document. Useful for tax filing, visa applications, or proving income."
            features={[
              "Time-scoped (any month, any range)",
              "Token-scoped (USDC only by default)",
              "Off-chain — no transaction fees",
              "Standard JSON audit package",
            ]}
            status="live"
            icon="document"
          />
          <ComplianceCard
            tag="For exchanges & institutions"
            title="Auditor access"
            description="Grant on-chain access to a regulated counterparty, like an exchange's KYC team or a licensed auditor. Real on-chain authorization that you can revoke at any time."
            features={[
              "On-chain authorization PDA",
              "Real revocation, transaction-backed",
              "Per-recipient, per-nonce scoping",
              "Recipient must have an Umbra account",
            ]}
            status="roadmap"
            icon="shield"
          />
        </div>

        <div className="mt-10 rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-privacy/10 border border-privacy/30 flex items-center justify-center shrink-0">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-privacy"
                aria-hidden
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-semibold text-foreground">
                Why two systems?
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                Different audiences need different tools. Your accountant
                isn&apos;t a crypto company, they want a key they can drop into
                a tool. An exchange is, they want on-chain proof and the
                ability to revoke. Payhaven ships both layers, drawing on
                Umbra&apos;s mixer-pool viewing keys and X25519 compliance
                grants respectively.
              </p>
              <a
                href="https://sdk.umbraprivacy.com/sdk/compliance"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-xs font-medium text-brand hover:text-brand-dark underline self-start"
              >
                Read Umbra&apos;s compliance docs ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Compliance card ──────────────────────────────────────────────────────

function ComplianceCard({
  tag,
  title,
  description,
  features,
  status,
  icon,
}: {
  tag: string;
  title: string;
  description: string;
  features: string[];
  status: "live" | "roadmap";
  icon: "document" | "shield";
}) {
  return (
    <div className="relative rounded-xl border border-border bg-card p-6 sm:p-8 flex flex-col gap-5 card-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="w-12 h-12 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
          {icon === "document" ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-brand"
              aria-hidden
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="13" y2="17" />
            </svg>
          ) : (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-brand"
              aria-hidden
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          )}
        </div>

        <span
          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border ${
            status === "live"
              ? "bg-privacy/10 border-privacy/30 text-privacy"
              : "bg-subtle border-border text-faint"
          }`}
        >
          {status === "live" ? "Live" : "Coming soon"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium uppercase tracking-wider text-faint">
          {tag}
        </div>
        <h3 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          {title}
        </h3>
      </div>

      <p className="text-sm text-muted leading-relaxed">{description}</p>

      <ul className="flex flex-col gap-2 pt-1 border-t border-border">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-sm text-foreground"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-privacy mt-0.5 shrink-0"
              aria-hidden
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="leading-snug">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}