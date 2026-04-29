"use client";

import { StagedProgress } from "./StagedProgress";

const STAGES = [
  { id: "verify", label: "Verifying your claim…" },
  { id: "proof",  label: "Generating proof…" },
  { id: "claim",  label: "Claiming via Umbra…" },
];

const ADVANCE_AT_MS = [2000, 8000];

type Props = {
  isComplete: boolean;
  onComplete: () => void;
  txSignature?: string;
};

export function ClaimProgress({ isComplete, onComplete, txSignature }: Props) {
  return (
    <StagedProgress
      stages={STAGES}
      advanceAtMs={ADVANCE_AT_MS}
      isComplete={isComplete}
      onComplete={onComplete}
      txSignature={txSignature}
    />
  );
}