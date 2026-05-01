export function BuiltOnUmbra() {
  return (
    <section className="w-full py-20 sm:py-28 bg-subtle/30 border-y border-border">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/umbra-logo.png"
            alt="Umbra"
            className="w-6 h-6 rounded-md"
          />
          <span className="text-xs font-medium uppercase tracking-wider text-privacy">
            Cryptography by Umbra
          </span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-foreground leading-tight">
          Built on Umbra. Settled on Solana.
        </h2>
        <p className="mt-6 text-base sm:text-lg text-muted leading-relaxed max-w-2xl mx-auto">
          Umbra&apos;s shielded pool, encrypted token accounts, gasless
          relayers, and selective-disclosure viewing keys, wrapped in an
          interface your family can actually use.
        </p>

        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PrimitiveBadge label="Shielded Pool" />
          <PrimitiveBadge label="Encrypted Balances" />
          <PrimitiveBadge label="Gasless Relayers" />
          <PrimitiveBadge label="Viewing Keys" />
        </div>

        <a
          href="https://sdk.umbraprivacy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark"
        >
          Read the Umbra docs
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </a>
      </div>
    </section>
  );
}

function PrimitiveBadge({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-xs sm:text-sm font-semibold text-foreground">
      {label}
    </div>
  );
}