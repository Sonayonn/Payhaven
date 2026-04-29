/**
 * Mock Nigerian bank account verification.
 *
 * Step 10.3 spec: the "Verify account" button shows a believable account
 * holder name after a 1s delay. We use a deterministic hash of the account
 * number against a small pool of plausible Nigerian names so:
 *   - Different account numbers → different names (more believable in demo)
 *   - Same account number → same name (idempotent, re-verifying doesn't flip)
 *
 * Real verification will come post-hackathon via Mono / Paystack / Flutterwave
 * NUBAN-resolution endpoints.
 */

export type NigerianBank = {
  code: string;
  name: string;
};

export const NIGERIAN_BANKS: NigerianBank[] = [
  { code: "058", name: "GTBank" },
  { code: "044", name: "Access Bank" },
  { code: "033", name: "United Bank for Africa" },
  { code: "057", name: "Zenith Bank" },
  { code: "011", name: "First Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "50211", name: "Kuda" },
  { code: "999992", name: "Opay" },
];

// Pool tuned for the Nigerian remittance corridor, Yoruba, Igbo, Hausa
// surnames represented. Names chosen to read as plausibly real without
// being any specific public figure.
const NAME_POOL = [
  "ADEOLA FATIMA",
  "OKAFOR CHIDINMA NGOZI",
  "IBRAHIM AISHA YUSUF",
  "OGUNLEYE TUNDE BABATUNDE",
  "EZE NNAMDI EMMANUEL",
  "BELLO HASSAN MUSA",
  "ADEBAYO FOLASADE MARY",
  "NWACHUKWU CHIOMA GRACE",
  "LAWAL KEMI ABISOLA",
  "OKONKWO IFEOMA BLESSING",
];

/**
 * Deterministic name for a 10-digit NUBAN. Same number → same name forever.
 */
export function mockResolveAccount(accountNumber: string): string {
  // Simple djb2-style hash. Not cryptographic, we just need stable bucketing.
  let hash = 5381;
  for (let i = 0; i < accountNumber.length; i++) {
    hash = ((hash << 5) + hash + accountNumber.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % NAME_POOL.length;
  return NAME_POOL[idx];
}

/**
 * Indicative parallel-market FX rate for the demo. Pulled from the spec's
 * "₦1,575/USD (parallel market)" placeholder. Real integration would fetch
 * from the off-ramp partner's quote endpoint per request.
 */
export const INDICATIVE_NGN_PER_USD = 1575;