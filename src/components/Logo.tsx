type LogoProps = {
  /** Width and height in px. Default 32. */
  size?: number;
  /** "mark" = symbol only. "lockup" = symbol + Payhaven wordmark. */
  variant?: "mark" | "lockup";
  className?: string;
};

/**
 * Payhaven logo.
 *
 * Iteration D, tilted offset rectangles. Background outline (slightly
 * tilted) represents the public balance; foreground filled cyan represents
 * the private balance. The tilt suggests motion/transformation between
 * the two states.
 *
 * The outline uses currentColor so it adapts to the surrounding text
 * color (dark in light mode, light in dark mode). The cyan fill is
 * fixed in both modes, that's the brand signal.
 */
export function Logo({ size = 32, variant = "mark", className }: LogoProps) {
  if (variant === "lockup") {
    return (
      <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
        <LogoMark size={size} />
        <span
          className="font-semibold tracking-tight"
          style={{ fontSize: size * 0.875, lineHeight: 1 }}
        >
          Payhaven
        </span>
      </div>
    );
  }
  return <LogoMark size={size} className={className} />;
}

function LogoMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Payhaven"
      className={className}
    >
      {/* Background layer, outline rectangle, slightly tilted (the "public" state) */}
      <g transform="rotate(-8 14 14)">
        <rect
          x="4"
          y="4"
          width="20"
          height="20"
          rx="5"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity="0.45"
        />
      </g>
      {/* Foreground layer, filled cyan (the "private" state) */}
      <rect x="14" y="14" width="22" height="22" rx="6" fill="#22D3EE" />
    </svg>
  );
}