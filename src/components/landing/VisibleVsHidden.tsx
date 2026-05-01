"use client";

/**
 * Side-by-side comparison: a normal Solana USDC transfer vs a Payhaven
 * encrypted send. Same on-chain action, two completely different exposure
 * profiles. This is the demo-image: the single visual that explains
 * Payhaven's privacy guarantee in one screenshot.
 */
export function VisibleVsHidden() {
  return (
    <section className="w-full py-20 sm:py-32 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-12 sm:mb-16">
          <div className="text-xs font-medium uppercase tracking-wider text-brand mb-3">
            On-chain comparison
          </div>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-foreground leading-tight">
            Both are real. Only one tells the world.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
            The exact same transfer. Once on a public wallet, once through Payhaven&apos;s
            shielded pool. See what Solscan can show and what it can&apos;t.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <ExposurePanel
            title="Standard USDC transfer"
            subtitle="Visible on Solscan to anyone, forever"
            tone="exposed"
            rows={[
              { label: "Sender", value: "4Q45eu…UVaN", visible: true },
              { label: "Recipient", value: "26McwuTU…wx6z", visible: true },
              { label: "Amount", value: "200.00 USDC", visible: true },
              { label: "Time", value: "2 minutes ago", visible: true },
              { label: "Memo", value: "March remittance", visible: true },
            ]}
          />

          <ExposurePanel
            title="Payhaven private send"
            subtitle="Same money, same chain. Different exposure."
            tone="protected"
            rows={[
              { label: "Sender", value: "6Qh1nT5x…FiNu", visible: true },
              { label: "Recipient", value: "encrypted", visible: false },
              { label: "Amount", value: "encrypted", visible: false },
              { label: "Time", value: "2 minutes ago", visible: true },
              { label: "Memo", value: "encrypted", visible: false },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-subtle/40 border border-border">
          <div className="flex items-start gap-3">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-privacy shrink-0 mt-0.5"
              aria-hidden
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div>
              <div className="text-sm font-semibold text-foreground">
                Sender wallet still appears on-chain
              </div>
              <div className="text-xs text-muted mt-0.5">
                Because that&apos;s where the funds came from. But the
                transaction itself reveals nothing. To outside observers,
                it&apos;s a deposit into a black box.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type Row = {
  label: string;
  value: string;
  visible: boolean;
};

function ExposurePanel({
  title,
  subtitle,
  tone,
  rows,
}: {
  title: string;
  subtitle: string;
  tone: "exposed" | "protected";
  rows: Row[];
}) {
  const isProtected = tone === "protected";

  return (
    <div
      className={`rounded-2xl border overflow-hidden card-shadow ${
        isProtected
          ? "border-privacy/30 bg-card"
          : "border-warning/30 bg-card"
      }`}
    >
      {/* Header bar */}
      <div
        className={`px-5 py-4 border-b ${
          isProtected
            ? "border-privacy/20 bg-privacy/5"
            : "border-warning/20 bg-warning/5"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-foreground">
              {title}
            </div>
            <div className="text-xs text-muted mt-0.5">{subtitle}</div>
          </div>
          <div
            className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${
              isProtected
                ? "bg-privacy/15 text-privacy"
                : "bg-warning/15 text-warning"
            }`}
          >
            {isProtected ? (
              <>
                <LockIcon />
                Encrypted
              </>
            ) : (
              <>
                <EyeIcon />
                Public
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pseudo-Solscan rows */}
      <div className="divide-y divide-border font-mono text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 px-5 py-3"
          >
            <span className="text-faint text-xs uppercase tracking-wide font-sans font-medium">
              {row.label}
            </span>
            {row.visible ? (
              <span className="text-foreground truncate">{row.value}</span>
            ) : (
              <EncryptedValue />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Visual placeholder for an encrypted field — animated cyan dots that
 * suggest "data exists here but you can't read it." Conveys encryption
 * without being literal about hashes or hex.
 */
function EncryptedValue() {
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-brand animate-pulse"
          style={{
            animationDelay: `${i * 0.08}s`,
            animationDuration: "1.6s",
          }}
        />
      ))}
      <span className="ml-2 text-xs text-faint font-sans not-italic">
        encrypted
      </span>
    </span>
  );
}

function LockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}