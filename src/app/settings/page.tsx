"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useBalances } from "@/hooks/useBalances";
import { SettingsHeader } from "@/components/SettingsHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { redactIdentifier } from "@/lib/format/identifiers";
import { ViewingKeyGenerateModal } from "@/components/ViewingKeyGenerateModal";
import { ViewingKeyGrantsList } from "@/components/ViewingKeyGrantsList";

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-6);
}

export default function SettingsPage() {
  const router = useRouter();
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallet } = useBalances();
  const [copied, setCopied] = useState<"address" | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [grantsRefreshKey, setGrantsRefreshKey] = useState(0);

  // Privy not ready or unauthenticated → kick to home, where login lives.
  if (ready && !authenticated) {
    router.replace("/");
    return null;
  }

  // Pull email/phone from Privy for display
  const linkedEmail =
    user?.linkedAccounts.find((a) => a.type === "email") &&
    "address" in user.linkedAccounts.find((a) => a.type === "email")!
      ? (user.linkedAccounts.find((a) => a.type === "email") as { address: string })
          .address
      : null;
  const linkedPhone =
    user?.linkedAccounts.find((a) => a.type === "phone") &&
    "number" in user.linkedAccounts.find((a) => a.type === "phone")!
      ? (user.linkedAccounts.find((a) => a.type === "phone") as { number: string })
          .number
      : null;

  async function copyAddress() {
    if (!wallet?.solanaAddress) return;
    try {
      await navigator.clipboard.writeText(wallet.solanaAddress);
      setCopied("address");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard blocked, long-press still works.
    }
  }

  return (
    <main className="flex flex-col flex-1 items-center p-4 pt-6 sm:p-6 sm:pt-8">
      <div className="w-full max-w-md flex justify-end mb-2">
        <ThemeToggle />
      </div>

      <SettingsHeader title="Settings" />

      <div className="flex flex-col gap-6 max-w-md w-full">
        {/* ── Account ──────────────────────────────────────────────── */}
        <Section title="Account">
          {linkedEmail && (
            <Field label="Email" value={redactIdentifier(linkedEmail)} mono />
          )}
          {linkedPhone && (
            <Field label="Phone" value={redactIdentifier(linkedPhone)} mono />
          )}
          {wallet?.solanaAddress && (
            <Field
              label="Payhaven address"
              value={truncateAddress(wallet.solanaAddress)}
              mono
              actions={
                <div className="flex gap-2">
                  <button
                    onClick={copyAddress}
                    className="text-xs font-medium text-brand hover:text-brand-dark transition-colors"
                  >
                    {copied === "address" ? "Copied!" : "Copy"}
                  </button>
                  <a
                    href={"https://solscan.io/account/" + wallet.solanaAddress}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-muted hover:text-foreground underline transition-colors"
                  >
                    Solscan ↗
                  </a>
                </div>
              }
            />
          )}
        </Section>

        {/* ── Privacy & Compliance ────────────────────────────────── */}
        <Section title="Privacy & Compliance">
          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">
                Share activity records
              </h3>
              <p className="text-xs text-muted leading-snug">
                For accountants and auditors. Generate a key that lets someone
                view your USDC activity for a specific time period. Send it
                like any document. Useful for tax filing, visa applications,
                or proving income.
              </p>
            </div>
            <button
              onClick={() => setGenerateOpen(true)}
              className="min-h-12 rounded-md bg-brand text-white text-sm font-semibold hover:bg-brand-dark active:scale-[0.98] brand-glow transition-all"
            >
              Generate viewing key
            </button>
            <ViewingKeyGrantsList
              refreshKey={grantsRefreshKey}
              onRevoke={() => setGrantsRefreshKey((k) => k + 1)}
            />
          </div>
          {/* Path 2, X25519 Compliance Grants, roadmap card. Real on-chain
              revocation is the institutional-tier compliance primitive Umbra
              ships. Different audience (regulated counterparties, exchanges)
              than the consumer audit-package flow above. */}
          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Auditor access
                </h3>
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-subtle border border-border text-faint font-medium">
                  Coming soon
                </span>
              </div>
              <p className="text-xs text-muted leading-snug">
                For exchanges and regulated institutions. Grants real on-chain
                access that you can revoke at any time. The recipient must
                have an Umbra account.
              </p>
            </div>
            <div className="rounded-md bg-subtle border border-border p-3 text-[11px] text-muted leading-snug">
              <span className="font-semibold text-foreground">
                Why two options?
              </span>{" "}
              Activity records work like sharing a document, anyone with the
              key can read it. Auditor access uses on-chain authorization, so
              you can take it back. Pick activity records for your accountant;
              auditor access is for institutions that need a verifiable trail.
            </div>
            <a
              href="https://sdk.umbraprivacy.com/sdk/compliance-x25519-grants"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-brand hover:text-brand-dark underline self-start"
            >
              Read the technical spec ↗
            </a>
          </div>

          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Verify your privacy
            </h3>
            <p className="text-xs text-muted leading-snug">
              Anyone can verify on Solscan that your private sends don&apos;t
              show up in your wallet&apos;s public activity, proof of the
              privacy guarantee.
            </p>
            {wallet?.solanaAddress && (
              <a
                href={"https://solscan.io/account/" + wallet.solanaAddress}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-brand hover:text-brand-dark underline self-start"
              >
                See your wallet on Solscan ↗
              </a>
            )}
          </div>
        </Section>

        {/* ── About ────────────────────────────────────────────────── */}
        <Section title="About">
          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-faint">
                Built on
              </span>
              <span className="px-2 py-0.5 rounded-full bg-privacy/10 border border-privacy/30 text-[11px] font-medium text-privacy">
                Umbra
              </span>
            </div>
            <p className="text-xs text-muted leading-snug">
              Payhaven is a privacy-first remittance app for the Nigerian
              diaspora, built on Solana with Umbra&apos;s shielded pool and
              encrypted balance primitives.
            </p>
            <div className="flex flex-col gap-1.5 pt-1">
              <a
                href="https://github.com/Sonayonn/Payhaven"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-brand hover:text-brand-dark underline self-start"
              >
                View on GitHub ↗
              </a>
              <a
                href="https://umbraprivacy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-muted hover:text-foreground underline self-start"
              >
                Learn about Umbra ↗
              </a>
            </div>
            <p className="text-[11px] text-faint pt-1">v0.1.0, pre-release</p>
          </div>
        </Section>

        {/* ── Sign out ────────────────────────────────────────────── */}
        <button
          onClick={() => {
            logout();
            router.replace("/");
          }}
          className="min-h-12 w-full rounded-md border border-danger/30 text-sm font-semibold text-danger hover:bg-danger/10 active:scale-[0.98] transition-all"
        >
          Sign out
        </button>
      </div>
      <ViewingKeyGenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={() => setGrantsRefreshKey((k) => k + 1)}
      />
    </main>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-faint px-1">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  actions,
}: {
  label: string;
  value: string;
  mono?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3 flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] uppercase tracking-wide text-faint">
          {label}
        </span>
        <span
          className={
            "text-sm text-foreground truncate " + (mono ? "font-mono" : "")
          }
        >
          {value}
        </span>
      </div>
      {actions}
    </div>
  );
}