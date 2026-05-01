import { Logo } from "@/components/Logo";
import { buildRequestInviteUrl } from "@/lib/whatsapp";

export function LandingFooter({ onHaveCode }: { onHaveCode: () => void }) {
  return (
    <footer className="w-full border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Last-call CTA */}
        <div className="mb-12 sm:mb-16 flex flex-col items-center text-center gap-5 max-w-2xl mx-auto">
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Ready to send privately?
          </h3>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <a
              href={buildRequestInviteUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-all brand-glow active:scale-[0.98] min-h-12"
            >
              Request an invite
            </a>
            <button
              onClick={onHaveCode}
              className="w-full sm:w-auto px-6 py-3 rounded-full border border-border text-foreground text-sm font-medium hover:bg-subtle active:scale-[0.98] transition-all min-h-12"
            >
              I have an invite code
            </button>
          </div>
        </div>

        {/* Footer rows */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pt-8 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-faint">
            <Logo size={20} variant="lockup" />
            <span className="ml-2">© 2026 Payhaven</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-faint">
            <a
              href="https://github.com/Sonayonn/Payhaven"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://sdk.umbraprivacy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Umbra
            </a>
            <span className="text-faint">
              Built for Solana Frontier Hackathon
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}