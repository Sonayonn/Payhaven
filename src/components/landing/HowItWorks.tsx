export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="w-full py-20 sm:py-32 bg-subtle/30"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl">
          <div className="text-xs font-medium uppercase tracking-wider text-brand mb-3">
            How it works
          </div>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-foreground leading-tight">
            Three steps. Zero crypto knowledge required.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
            Built so your aunt in Lagos can use it. Built so your money home
            doesn&apos;t announce itself to the world.
          </p>
        </div>

        <div className="mt-14 sm:mt-20 grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          <Step
            number="01"
            title="Send"
            body="Enter their phone or email and an amount. We turn your USDC into an encrypted, untraceable note."
            visualKind="send"
          />
          <Step
            number="02"
            title="Hide"
            body="The note travels through Umbra's shielded pool. No wallet addresses, no balances, nothing visible to outsiders."
            visualKind="hide"
          />
          <Step
            number="03"
            title="Receive"
            body="You give your recipient a link on Whatsapp. They tap it, sign in, and the money lands, visible only to them."
            visualKind="receive"
          />
        </div>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  body,
  visualKind,
}: {
  number: string;
  title: string;
  body: string;
  visualKind: "send" | "hide" | "receive";
}) {
  return (
    <div className="bg-card p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-faint">{number}</span>
        <StepVisual kind={visualKind} />
      </div>
      <h3 className="text-2xl font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function StepVisual({ kind }: { kind: "send" | "hide" | "receive" }) {
  if (kind === "send") {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
        <rect
          x="8"
          y="14"
          width="40"
          height="28"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-border"
        />
        <line
          x1="8"
          y1="22"
          x2="48"
          y2="22"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-border"
        />
        <circle cx="14" cy="18" r="1" fill="currentColor" className="text-faint" />
        <circle cx="18" cy="18" r="1" fill="currentColor" className="text-faint" />
        <text
          x="28"
          y="35"
          textAnchor="middle"
          className="fill-foreground"
          fontSize="11"
          fontWeight="600"
          fontFamily="ui-monospace, monospace"
        >
          $200
        </text>
      </svg>
    );
  }
  if (kind === "hide") {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
        <rect
          x="14"
          y="22"
          width="28"
          height="22"
          rx="4"
          fill="#10B981"
          fillOpacity="0.12"
          stroke="#10B981"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
        <path
          d="M21 22V18a7 7 0 0 1 14 0v4"
          stroke="#10B981"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="28" cy="33" r="2" fill="#10B981" />
      </svg>
    );
  }
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      <rect
        x="10"
        y="10"
        width="36"
        height="36"
        rx="8"
        fill="#25D366"
        fillOpacity="0.12"
        stroke="#25D366"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <path
        d="M19 24c0-2.8 2.2-5 5-5h8c2.8 0 5 2.2 5 5v6c0 2.8-2.2 5-5 5h-3l-4 4v-4h-1c-2.8 0-5-2.2-5-5v-6z"
        fill="#25D366"
      />
    </svg>
  );
}