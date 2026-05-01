"use client";

/**
 * Custom animated background for the landing hero.
 *
 * Visualizes Payhaven's core privacy architecture: a sender wallet, the
 * Umbra shielded pool, and a recipient wallet. The pool shimmers softly
 * with cyan particles, suggesting "this is where privacy happens."
 *
 * Pure SVG + CSS animation. No external libraries. Renders at 10% opacity
 * so it sits as ambient background behind hero copy without competing.
 */
export function LandingHeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Soft radial glow anchor — provides depth */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 30%, rgba(34, 211, 238, 0.10), transparent 60%)",
        }}
      />

      {/* Subtle grid pattern */}
      <svg
        className="absolute inset-0 w-full h-full text-foreground"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <pattern
            id="payhaven-grid"
            width="56"
            height="56"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M56 0H0V56"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.04"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#payhaven-grid)" />
      </svg>

      {/* Privacy flow visualization — sender → shielded pool → recipient */}
      <svg
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        width="1200"
        height="500"
        viewBox="0 0 1200 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          {/* Pool gradient — cyan core fading to transparent edges */}
          <radialGradient id="pool-gradient" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.18" />
            <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
          </radialGradient>

          {/* Soft blur for the pool ambient layer */}
          <filter id="pool-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="20" />
          </filter>
        </defs>

        {/* ── Sender node (left) ──────────────────────────────── */}
        <g opacity="0.5">
          <circle cx="200" cy="250" r="6" fill="#22D3EE" />
          <circle
            cx="200"
            cy="250"
            r="14"
            stroke="#22D3EE"
            strokeWidth="1"
            fill="none"
            opacity="0.4"
          />
        </g>

        {/* Sender → pool line */}
        <line
          x1="220"
          y1="250"
          x2="450"
          y2="250"
          stroke="#22D3EE"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.25"
        />

        {/* Traveling dot: sender → pool */}
        <circle r="3" fill="#22D3EE" opacity="0.7">
          <animateMotion
            path="M 220 250 L 450 250"
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>

        {/* ── Shielded pool (center, large) ───────────────────── */}
        {/* Soft ambient blur layer */}
        <circle
          cx="600"
          cy="250"
          r="160"
          fill="url(#pool-gradient)"
          filter="url(#pool-blur)"
        />
        {/* Pool boundary */}
        <circle
          cx="600"
          cy="250"
          r="140"
          stroke="#22D3EE"
          strokeWidth="1"
          fill="none"
          opacity="0.2"
          strokeDasharray="2 6"
        />
        {/* Inner pool boundary */}
        <circle
          cx="600"
          cy="250"
          r="100"
          stroke="#22D3EE"
          strokeWidth="0.5"
          fill="none"
          opacity="0.15"
        />

        {/* Encrypted glyphs floating inside pool — cluster of small particles */}
        <g opacity="0.6">
          {Array.from({ length: 24 }).map((_, i) => {
            // Distribute particles in a circular cloud inside the pool
            const angle = (i / 24) * Math.PI * 2;
            const radius = 30 + (i % 5) * 18;
            const x = 600 + Math.cos(angle) * radius;
            const y = 250 + Math.sin(angle) * radius;
            const dur = 4 + (i % 4);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={1.5}
                fill="#22D3EE"
                opacity="0.5"
              >
                <animate
                  attributeName="opacity"
                  values="0.2;0.8;0.2"
                  dur={`${dur}s`}
                  repeatCount="indefinite"
                  begin={`${i * 0.15}s`}
                />
              </circle>
            );
          })}
        </g>

        {/* Pool → recipient line */}
        <line
          x1="750"
          y1="250"
          x2="980"
          y2="250"
          stroke="#22D3EE"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.25"
        />

        {/* Traveling dot: pool → recipient */}
        <circle r="3" fill="#22D3EE" opacity="0.7">
          <animateMotion
            path="M 750 250 L 980 250"
            dur="3s"
            repeatCount="indefinite"
            begin="1.5s"
          />
        </circle>

        {/* ── Recipient node (right) ──────────────────────────── */}
        <g opacity="0.5">
          <circle cx="1000" cy="250" r="6" fill="#22D3EE" />
          <circle
            cx="1000"
            cy="250"
            r="14"
            stroke="#22D3EE"
            strokeWidth="1"
            fill="none"
            opacity="0.4"
          />
        </g>

        {/* Tiny labels — visible only at desktop sizes, very subtle */}
        <g opacity="0.4" className="hidden sm:block">
          <text
            x="200"
            y="295"
            textAnchor="middle"
            className="fill-foreground"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
          >
            sender
          </text>
          <text
            x="600"
            y="430"
            textAnchor="middle"
            className="fill-foreground"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
          >
            shielded pool
          </text>
          <text
            x="1000"
            y="295"
            textAnchor="middle"
            className="fill-foreground"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
          >
            recipient
          </text>
        </g>
      </svg>
    </div>
  );
}