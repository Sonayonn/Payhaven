"use client";

import { StagedProgress } from "./StagedProgress";

const STAGES = [
  { id: "prep",    label: "Preparing your withdrawal…" },
  { id: "decrypt", label: "Decrypting via MPC…" },
  { id: "confirm", label: "Confirming on Solana…" },
];

const ADVANCE_AT_MS = [3000, 15000];

type Props = {
  isComplete: boolean;
  onComplete: () => void;
  txSignature?: string;
};

export function UnshieldProgress({ isComplete, onComplete, txSignature }: Props) {
  return (
    <StagedProgress
      stages={STAGES}
      advanceAtMs={ADVANCE_AT_MS}
      isComplete={isComplete}
      onComplete={onComplete}
      doneLabel="Unshielded"
      txSignature={txSignature}
    />
  );
}