"use client";

import { useState } from "react";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { LoginButton } from "@/components/LoginButton";
import { SenderWalletCard } from "@/components/SenderWalletCard";
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
    <main className="flex flex-col flex-1 items-center p-4 pt-8 sm:p-6 sm:pt-16">
      <div className="flex flex-col items-center gap-6 max-w-md w-full">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-semibold">Payhaven</h1>
          <p className="text-zinc-600 text-sm">Private USDC remittance.</p>
        </div>

        <LoginButton />

        {ready && authenticated && (
          <>
            <SenderWalletCard />

            <div className="w-full border-t pt-6">
              <ComposeSend onSuccess={recordSend} />
            </div>

            <SendHistory records={history} />

            <DebugShieldButton />
          </>
        )}
      </div>
    </main>
  );
}

function DebugShieldButton() {
  async function testEncryptedBalance() {
    const tok = await getAccessToken();
    const r = await fetch("/api/encrypted-balance", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    console.log("Encrypted balance:", await r.json());
  }

  async function testShield() {
    const tok = await getAccessToken();
    const r = await fetch("/api/shield", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tok}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amountUsdc: 0.10 }),
    });
    console.log("Shield result:", await r.json());
  }

  async function testUnshield() {
    const tok = await getAccessToken();
    const r = await fetch("/api/unshield", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tok}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amountUsdc: 0.05 }),
    });
    console.log("Unshield result:", await r.json());
  }

  return (
    <div className="mt-8 p-4 border-2 border-dashed border-orange-300 rounded w-full">
      <div className="text-xs font-bold text-orange-700 mb-2">
        DEBUG (remove later)
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={testEncryptedBalance}
          className="px-3 py-2 bg-blue-500 text-white text-sm rounded"
        >
          Check encrypted balance
        </button>
        <button
          onClick={testShield}
          className="px-3 py-2 bg-orange-500 text-white text-sm rounded"
        >
          Shield $0.10
        </button>
        <button
          onClick={testUnshield}
          className="px-3 py-2 bg-purple-500 text-white text-sm rounded"
        >
          Unshield $0.05
        </button>
      </div>
    </div>
  );
}