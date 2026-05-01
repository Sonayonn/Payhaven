"use client";

import { useState } from "react";
import { LandingHero } from "./LandingHero";
import { HowItWorks } from "./HowItWorks";
import { WhyPrivacy } from "./WhyPrivacy";
import { BuiltOnUmbra } from "./BuiltOnUmbra";
import { Compliance } from "./Compliance";
import { VisibleVsHidden } from "./VisibleVsHidden";
import { LandingFooter } from "./LandingFooter";
import { InviteCodeModal } from "@/components/InviteCodeModal";
import { buildRequestInviteUrl } from "@/lib/whatsapp";
import { ProofNotPromises } from "./ProofNotPromises";

export function LandingPage() {
  const [inviteOpen, setInviteOpen] = useState(false);

  function handleRequestInvite() {
    window.open(buildRequestInviteUrl(), "_blank", "noopener,noreferrer");
  }

  function handleHaveCode() {
    setInviteOpen(true);
  }

  return (
    <main className="min-h-screen bg-background">
      <LandingHero
        onRequestInvite={handleRequestInvite}
        onHaveCode={handleHaveCode}
      />
      <HowItWorks />
      <VisibleVsHidden />
      <WhyPrivacy />
      <ProofNotPromises />
      <Compliance />
      <BuiltOnUmbra />
      <LandingFooter onHaveCode={handleHaveCode} />

      <InviteCodeModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </main>
  );
}