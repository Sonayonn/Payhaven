"use client";

import { StagedProgress } from "./StagedProgress";

const STAGES = [
  { id: "proof",   label: "Generating zero-knowledge proof…" },
  { id: "mpc",     label: "Submitting to Umbra MPC…" },
  { id: "confirm", label: "Confirming on Solana…" },
];

const ADVANCE_AT_MS = [3000, 15000];

type Props = {
  isComplete: boolean;
  onComplete: () => void;
  txSignature?: string;
};

export function SendProgress({ isComplete, onComplete, txSignature }: Props) {
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