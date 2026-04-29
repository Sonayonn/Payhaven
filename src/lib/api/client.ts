"use client";

import { getAccessToken } from "@privy-io/react-auth";

export type SendRequest = {
  recipient: { kind: "email" | "phone"; value: string };
  amountUsdc: number;
};

export type SendSuccess = {
  ok: true;
  claimToken: string;
  claimUrl: string;             
  expiresAt: string;
  createUtxoSignature: string;
};

export type SendError = {
  ok?: false;
  error: { code: string; message: string };
};

export async function sendUsdc(body: SendRequest): Promise<SendSuccess> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not signed in");
  }

  const res = await fetch("/api/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as SendSuccess | SendError;

  if (!res.ok || !("ok" in data) || data.ok !== true) {
    const err = (data as SendError).error;
    throw new SendFailure(err?.code ?? "UNKNOWN", err?.message ?? "Send failed");
  }

  return data;
}

export class SendFailure extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "SendFailure";
  }
}
// ── Shield ────────────────────────────────────────────────────────────────

export type ShieldRequest = {
  amountUsdc: number;
};

export type ShieldSuccess = {
  ok: true;
  queueSignature: string;
  callbackSignature?: string;
  callbackElapsedMs?: number;
  rentClaimError?: string;
};

export class ShieldFailure extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ShieldFailure";
  }
}

export async function shieldUsdc(body: ShieldRequest): Promise<ShieldSuccess> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not signed in");
  }

  const res = await fetch("/api/shield", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.ok !== true) {
    const err = data?.error;
    throw new ShieldFailure(
      err?.code ?? "UNKNOWN",
      err?.message ?? "Shield failed",
    );
  }

  return data as ShieldSuccess;
}
// ── Unshield ──────────────────────────────────────────────────────────────

export type UnshieldRequest = {
  amountUsdc: number;
};

export type UnshieldSuccess = {
  ok: true;
  queueSignature: string;
  callbackSignature?: string;
  callbackElapsedMs?: number;
};

export class UnshieldFailure extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "UnshieldFailure";
  }
}

export async function unshieldUsdc(
  body: UnshieldRequest,
): Promise<UnshieldSuccess> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not signed in");
  }

  const res = await fetch("/api/unshield", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.ok !== true) {
    const err = data?.error;
    throw new UnshieldFailure(
      err?.code ?? "UNKNOWN",
      err?.message ?? "Unshield failed",
    );
  }

  return data as UnshieldSuccess;
}