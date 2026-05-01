export function WhyPrivacy() {
  return (
    <section className="w-full py-20 sm:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
          {/* Left: copy */}
          <div className="md:col-span-7">
            <div className="text-xs font-medium uppercase tracking-wider text-warning mb-3">
              Why privacy matters
            </div>
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-foreground leading-tight">
              Crypto remittances shouldn&apos;t paint a target on your family.
            </h2>
            <div className="mt-6 space-y-4 text-base text-muted leading-relaxed">
              <p>
                Nigeria received{" "}
                <span className="font-semibold text-foreground">$21B</span> in
                remittances in 2024, the highest in five years. It also saw{" "}
                <span className="font-semibold text-foreground">
                  2.2 million kidnappings
                </span>{" "}
                in a single twelve-month period. 91% of them were for ransom.
              </p>
              <p>
                Every public USDC transfer is a billboard. On-chain
                surveillance plus a single KYC leak means criminals can
                identify, profile, and target the recipients of foreign
                remittances.
              </p>
              <p>
                Existing crypto remittance apps moved money cheaply. They left
                it fully visible. We&apos;re fixing the half they skipped.
              </p>
            </div>
          </div>

          {/* Right: stat cards */}
          <div className="md:col-span-5 grid grid-cols-1 gap-3">
            <StatCard
              value="$20.98B"
              label="Nigerian remittance inflows, 2024"
              source="CBN"
            />
            <StatCard
              value="2.2M"
              label="Kidnappings, May 2023 – April 2024"
              source="NBS"
              accent="warning"
            />
            <StatCard
              value="73%"
              label="Nigerians who own or have purchased crypto"
              source="ConsenSys / YouGov 2024"
            />
            <StatCard
              value="#2"
              label="Global crypto adoption ranking"
              source="Chainalysis"
              accent="brand"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  value,
  label,
  source,
  accent,
}: {
  value: string;
  label: string;
  source: string;
  accent?: "warning" | "brand";
}) {
  const accentClass =
    accent === "warning"
      ? "text-warning"
      : accent === "brand"
        ? "text-brand"
        : "text-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1">
      <div className={`balance-number text-3xl sm:text-4xl font-semibold ${accentClass}`}>
        {value}
      </div>
      <div className="text-sm text-foreground leading-snug">{label}</div>
      <div className="text-[11px] text-faint mt-1">Source: {source}</div>
    </div>
  );
}