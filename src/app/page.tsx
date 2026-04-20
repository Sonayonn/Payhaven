"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { LoginButton } from "@/components/LoginButton";
import { ComposeSend } from "@/components/ComposeSend";
import { SendHistory, type SendRecord } from "@/components/SendHistory";

export default function Home() {
  const { ready, authenticated } = usePrivy();
  const [history, setHistory] = useState<SendRecord[]>([]);

  function recordSend(record: Omit<SendRecord, "id" | "timestamp">) {
    setHistory((prev) => [
      { ...record, id: crypto.randomUUID(), timestamp: Date.now() },
      ...prev,
    ]);
  }

  return (
    <main className="flex flex-col flex-1 items-center p-6 pt-16">
      <div className="flex flex-col items-center gap-8 max-w-md w-full">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-semibold">Payhaven</h1>
          <p className="text-zinc-600 text-sm">Private USDC remittance.</p>
        </div>

        <LoginButton />

        {ready && authenticated && (
          <>
            <div className="w-full border-t pt-6">
              <ComposeSend onSuccess={recordSend} />
            </div>
            <SendHistory records={history} />
          </>
        )}
      </div>
    </main>
  );
}