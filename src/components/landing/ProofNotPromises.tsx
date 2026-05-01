"use client";

/**
 * "Proof, not promises" — real Solana mainnet transaction signatures from
 * Payhaven's privacy primitives, with Solscan links. Demonstrates that
 * every step of the privacy lifecycle works on mainnet, not a testnet,
 * not a mock. This is unfakeable evidence.
 */

type Receipt = {
  primitive: string;
  description: string;
  signature: string;
  callbackMs: number;
};

const RECEIPTS: Receipt[] = [
  {
    primitive: "Shield",
    description: "Move USDC from public ATA into encrypted balance.",
    signature:
      "2Uwj6vf3FTFrTsQfxP2kiwSA7KdTn2qtUQnStt15R7yhWT65UP21d4VxcBWk23Rdwvo8zn4szKtDHUCL2DkvDke8",
    callbackMs: 4650,
  },
  {
    primitive: "Encrypted-balance send",
    description:
      "Send USDC privately. Sender wallet visible, amount and recipient encrypted.",
    signature:
      "3beVmcbQehwgwrXWL1BYLnArQF5qBx9QqEZJ4hBewfUPFaA9NGH9J3mByNwqtgxMKk3HqomBhukAnQUHRLwbkgUL",
    callbackMs: 4650,
  },
  {
    primitive: "Unshield",
    description: "Move USDC from encrypted balance back to public ATA for offramp.",
    signature:
      "5ahP7RCM5Paxy9wZezS1gZSceNnUNwK61ALK3BEuwDeUMBnqJdcNv2BStJdxqxnLf1cYnRMroUxKxmYrKZq8jBMR",
    callbackMs: 3992,
  },
];

export function ProofNotPromises() {
  return (
    <section className="w-full py-20 sm:py-32 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-12 sm:mb-16">
          <div className="text-xs font-medium uppercase tracking-wider text-privacy mb-3">
            Proof, not promises
          </div>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-foreground leading-tight">
            Every primitive, working on Solana mainnet.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
            No bridges. No L2s. No testnet. Below are real transaction
            signatures from our privacy lifecycle, finalized in seconds via
            Arcium MPC. Click any signature to verify on Solscan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {RECEIPTS.map((receipt) => (
            <ReceiptCard key={receipt.primitive} receipt={receipt} />
          ))}
        </div>

        <div className="mt-10 flex items-center gap-3 text-sm text-muted">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-privacy shrink-0"
            aria-hidden
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>
            Total wall-clock time across all three:{" "}
            <span className="font-semibold text-foreground">
              ~13 seconds end-to-end
            </span>
            .
          </span>
        </div>
      </div>
    </section>
  );
}

function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const truncated = `${receipt.signature.slice(0, 8)}…${receipt.signature.slice(-8)}`;
  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 flex flex-col gap-4 card-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-foreground">
            {receipt.primitive}
          </div>
          <div className="mt-1 text-xs text-muted leading-relaxed">
            {receipt.description}
          </div>
        </div>
        <div className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-privacy/15 text-privacy text-[11px] font-medium">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {receipt.callbackMs}ms
        </div>
      </div>
      <a
      
        href={`https://solscan.io/tx/${receipt.signature}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-md border border-border bg-subtle hover:bg-border transition-colors"
      >
        <span className="font-mono text-xs text-muted group-hover:text-foreground transition-colors truncate">
          {truncated}
        </span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-faint group-hover:text-brand shrink-0 transition-colors"
          aria-hidden
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </div>
  );
}