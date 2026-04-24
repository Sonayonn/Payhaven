"use client";

import { getAccessToken } from "@privy-io/react-auth";

export type SendRequest = {
  recipient: { kind: "email" | "phone"; value: string };
  amountUsdc: number;
};

export type SendSuccess = {
  ok: true;
  claimToken: string;
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