"use client";

export type SendRecord = {
  id: string;
  recipientAddress: string;
  amountUsdc: number;
  txSignature: string;
  timestamp: number;
};

export function SendHistory({ records }: { records: SendRecord[] }) {
  if (records.length === 0) return null;

  return (
    <div className="w-full border-t pt-6 flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Recent sends</h2>
      <div className="flex flex-col gap-2">
        {records.map((r) => (
          <div
            key={r.id}
            className="p-3 border rounded flex flex-col gap-1 text-sm"
          >
            <div className="flex justify-between items-start gap-2">
              <span className="font-medium">${r.amountUsdc.toFixed(2)} USDC</span>
              <span className="text-xs text-zinc-500">
                {new Date(r.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-xs font-mono text-zinc-600 truncate">
              to {r.recipientAddress}
            </div>
            <a
              href={`https://solscan.io/tx/${r.txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              View on Solscan →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}