# Payhaven — Conventions

Rules we've decided to follow on this project, and the hard-won context behind why. Read before touching anything SDK-adjacent.

Last updated: Day 1 closed (April 19, 2026)

---

## 1. The `.d.ts` files are the spec, not the docs

**Rule:** Before writing any call that touches `@umbra-privacy/sdk`, verify the shape against `node_modules/@umbra-privacy/sdk/dist/*.d.ts`. Do not copy-paste from [docs.umbraprivacy.com](https://docs.umbraprivacy.com) or [sdk.umbraprivacy.com](https://sdk.umbraprivacy.com) without first cross-referencing the actual TypeScript types.

**Why:** On Day 1 we found nine instances of docs contradicting the real types on `@umbra-privacy/sdk@2.0.3`. Each one cost us time. A 30-second check against the `.d.ts` catches every single one before it turns into a runtime error.

**How to check quickly:**

```bash
# See all exports from the main SDK
node -e "console.log(Object.keys(require('@umbra-privacy/sdk')).join('\n'))"

# Find exports matching a pattern
node -e "console.log(Object.keys(require('@umbra-privacy/sdk')).filter(n => /claim/i.test(n)).join('\n'))"

# Inspect a type definition
grep -A 20 "^interface ClaimableUtxoData" node_modules/@umbra-privacy/sdk/dist/*.d.ts
```

### Known doc drift (as of `@umbra-privacy/sdk@2.0.3`)

| # | Docs say | Reality |
|---|---|---|
| 1 | Scanner returns `{ received }` or `{ selfBurnable }` | Returns `{ received, selfBurnable, publicReceived, publicSelfBurnable }` |
| 2 | Claimer deps are `{ zkProver, relayer }` | Needs a third: `fetchBatchMerkleProof` from `getBatchMerkleProofFetcher({ apiEndpoint })` |
| 3 | `createUtxo()` returns an array of signatures | Returns `{ createProofAccountSignature, createUtxoSignature, closeProofAccountSignature? }` |
| 4 | Claim result has `.signatures` (Record) | Has `.batches: Map<U32, ClaimBatchResult>` where each batch has `txSignature`, `callbackSignature`, `status`, `failureReason` |
| 5 | `getUserRegistrationFunction` takes no deps | Needs `{ zkProver: getUserRegistrationProver() }` when `anonymous: true` |
| 6 | Prover is `getPublicBalanceToReceiverClaimableUtxoCreatorProver` | Actual export: `getCreateReceiverClaimableUtxoFromPublicBalanceProver` |
| 7 | UTXO ordering field is `leafIndex` | Scan-stage `DecryptedUtxoData` has `insertionIndex`; `leafIndex` only exists on claim-stage `ClaimableUtxoData` |
| 8 | Indexer URL varies by page — `indexer.api.umbraprivacy.com` vs `utxo-indexer.api.umbraprivacy.com` | Use `utxo-indexer.api.umbraprivacy.com` (confirmed working) |
| 9 | `U32`, `U64`, `Address` importable from root | Only exported from `@umbra-privacy/sdk/types` |

When you find new drift, add it here.

---

## 2. Money validation: edges strict, internals loose

**Rule:** Validate amounts and addresses with Zod at every trust boundary (user input, API routes, responses we persist, SDK return values we store). Once inside a trust context, `as U64` and move fast.

**Why:** The typed brand `U64` is a lie the compiler believes. That lie is safe when the value came from our own code; dangerous when it came from outside. Runtime validation at edges catches the dangerous case; casts inside are free velocity.

**Where:**

- **Input edges:** form submission, query strings, decoded JWTs, webhook payloads, decrypted SDK ciphertexts we'll persist
- **Internal:** helper functions, private methods, anything that only talks to other internal code

**What to validate:**

- Amounts: `z.bigint().nonnegative().lte(U64_MAX)`
- Addresses: `z.string().length(43).refine(addr => { try { return !!address(addr); } catch { return false; } })`
- Token mints: same as addresses, plus check against our allowlist of supported mints

### The money module

Build this on Day 2 as `src/lib/money.ts`. Exactly two public functions:

```ts
// Safe human-to-base-units conversion. USDC has 6 decimals.
export function usdcToBaseUnits(humanAmount: number): U64
// Inverse, for display.
export function baseUnitsToUsdc(base: U64): number
```

Both Zod-validated. Both tested. Called exactly once at each boundary — never let a `bigint` cross a boundary without being sure whose decimals it's in. This saves six hours of Sprint 3 confusion when a claim silently shows up as $0.0002 USDC.

---

## 3. Umbra primitive cheat sheet

**Rule:** Before writing any Umbra call, state out loud (in a code comment) which primitive it uses and why.

### The four UTXO creators — pick by funding source × recipient

| Funding | Recipient | Function |
|---|---|---|
| Public ATA | self | `getPublicBalanceToSelfClaimableUtxoCreatorFunction` |
| Public ATA | someone else | `getPublicBalanceToReceiverClaimableUtxoCreatorFunction` ← **Payhaven treasury uses this** |
| Encrypted balance | self | `getEncryptedBalanceToSelfClaimableUtxoCreatorFunction` |
| Encrypted balance | someone else | `getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction` |

Each one requires a matching ZK prover from `@umbra-privacy/web-zk-prover`. The prover names are prefixed `getCreate...`, not `get...Prover` as the docs suggest.

### Scanner result buckets

`getClaimableUtxoScannerFunction` returns four buckets. The bucket is determined by (funding source × who created the UTXO):

- `received` — UTXOs someone sent you, funded from their encrypted balance
- `publicReceived` — UTXOs someone sent you, funded from their public ATA ← **Payhaven recipients get these**
- `selfBurnable` — UTXOs you created for yourself, from your encrypted balance
- `publicSelfBurnable` — UTXOs you created for yourself, from your public ATA

The "public" prefix refers to **funding source only**, not privacy properties. All four buckets are cryptographically identical once committed — they're in the same Merkle tree, claimed with the same ZK circuit, break the same on-chain sender-receiver link. The split is scanner metadata, not a privacy distinction.

### The single receiver-claimable claimer

There is exactly one claim function for UTXOs sent to you — `getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction`. It handles both `received` and `publicReceived`. Don't look for a "public" variant; none exists.

**Required deps:**
```ts
{
  zkProver: getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver(),
  relayer: getUmbraRelayer({ apiEndpoint: UMBRA_RELAYER }),
  fetchBatchMerkleProof: getBatchMerkleProofFetcher({ apiEndpoint: UMBRA_INDEXER }),
}
```

All three are required. Docs show only two.

---

## 4. Registration is a one-way door

**Rule:** Call `getUserRegistrationFunction(...)` exactly once per keypair, ever. Never re-run registration on an already-registered keypair.

**Why:** Registration rotates keys. Any UTXOs previously addressed to the old keys become unclaimable. On Day 1 we locked this behind a `REGISTER=true` env flag and documented the warning. Keep that pattern.

**Cost:** ~0.01–0.02 SOL per account (roughly $1-2 at current prices). 3 transactions per account. The SDK's relayer does **not** pay for registration — the keypair must already hold SOL.

**Implication for product:** recipients can't claim their first UTXO unless they have SOL. The treasury is responsible for airdropping dust SOL (~0.02) to a recipient's wallet right before their first claim. Bake this into the send flow, not the claim flow — the claim function from the SDK assumes registration is done.

---

## 5. Cost model (mainnet, post-Day 1 measurements)

| Operation | SOL cost | Who pays |
|---|---|---|
| Registration (first-time, per keypair) | ~0.015 SOL | That keypair |
| UTXO creation (public → receiver) | ~0.002 SOL + protocol fee in USDC | Treasury |
| Scanner call | $0 | (indexer reads, no tx) |
| Claim (gasless via relayer) | $0 on recipient | Umbra relayer |
| Protocol fees on UTXO creation | small, deducted from amount | Effectively the sender |

Budget ~0.05 SOL per treasury instance plus 0.02 SOL per recipient first-time payment.

---

## 6. Privy + Umbra: compatible (confirmed by research, not yet by code)

Day 1 research confirmed:
- Privy's embedded Solana wallet exposes a `signMessage` method
- Returns an Ed25519 signature (verified in docs via `nacl.sign.detached.verify`)
- Provider shape mimics Phantom, which implements Wallet Standard
- `createSignerFromWalletAccount` from the Umbra SDK is the right adapter

Still to verify on Day 3 with actual code:
1. React SDK vs Expo SDK shape differences
2. `signMessage` signature encoding (base64 string vs raw `Uint8Array`)
3. UX of the master-seed prompt — should fire exactly once at onboarding, not per-send

If Privy turns out to need a thin adapter shim, we write a 30-line wrapper. If Privy is fundamentally incompatible (not expected), Dynamic or Web3Auth are fallbacks.

---

## 7. Network choices

- **Chain:** Solana **mainnet**, not devnet. Confirmed by Umbra: devnet only has WSOL pools. USDC pools only exist on mainnet.
- **RPC:** Helius free tier for development. Public `api.mainnet-beta.solana.com` works but is rate-limited and laggy. Both in `.env`, Helius enabled.
- **Relayer:** Umbra's public relayer at `relayer.api.umbraprivacy.com`. Rate limits are fine for hackathon judging (confirmed with Umbra team). For production scale, the SDK's relayer is pluggable — we'd self-host using `getEncryptedBalanceClaimRelayerForwarderFunction`.
- **Indexer:** `utxo-indexer.api.umbraprivacy.com` (not `indexer.api...`).

---

## 8. Secret handling

**Rule:** Keypair files, API keys, and `.env` contents never leave the local machine. Never paste them into chat, Slack, GitHub issues, or screenshots.

**What goes in `.gitignore`:**
- `.env`, `.env.local`
- `treasury.json`, `recipient.json`, `*-keypair.json`

**If you accidentally leak a key:** rotate immediately. Helius lets you regenerate keys from the dashboard. Don't rely on "it's probably fine."

**When pasting terminal output in chat (even with me):** redact secrets first. For URLs with embedded keys:
```bash
cat .env | sed 's/api-key=\([a-z0-9]\{4\}\).*/api-key=\1...REDACTED/'
```

---

## 9. Known issues — resolved and outstanding

### Resolved

**`TimestampDifferenceExceedsMaximum` (Umbra error 14008) on claim** — RESOLVED.

Symptom: on-chain Umbra program rejected claims with `Error Code: TimestampDifferenceExceedsMaximum. Error Number: 14008` thrown from `programs/umbra/src/instructions/claim/to_encrypted_token_account/new_token_shared.rs:853`. Failed twice with two different RPC providers (public mainnet + Helius free tier).

Cause: home network was high-latency / unstable, stretching the proof-submission round-trip past Umbra's freshness window. Umbra confirmed the window is **5 minutes** of allowed drift between proof generation and on-chain submission. A saturated or lossy connection can stretch the round-trip past that limit even when the local clock is perfectly NTP-synced.

Fix: operational, not code. Submission must happen from a stable network. No SDK or protocol changes needed. Verified working on Starlink — claim succeeded first retry, request ID `bbc366a6-dd94-47d5-bc3c-9d972333b857`, on-chain tx `HEobMLgLPu1ZrbiH65hc7D7XHGS5Ch7PX4fC3NwB8kJKufMjDGV3BerFrgpXcCz6meMEYyEYpUjFYCcG6AV9bNd`.

**Implication for Payhaven:** the sender device's network quality directly affects whether their UTXO creation succeeds. For production, this means the Privy-embedded wallet does proof generation in the user's browser — a user on shaky mobile data could hit this. Two mitigations to keep in mind:

- For the hackathon demo: record from a known-stable network (Starlink, fiber, etc.). Don't demo from a coffee shop.
- For production: surface a clear "submission failed, please retry on a better connection" error rather than the cryptic on-chain error code. Wrap the Umbra error in a user-friendly message.

### Outstanding (still waiting on Umbra)

- **Gasless registration.** Not confirmed whether Umbra's relayer supports it. Currently assuming "no" and budgeting dust SOL per recipient. Asked in the consolidated message; awaiting answer.
- **Treasury-escrow pattern validation.** Asked Umbra whether `publicReceived` + treasury-funded UTXO is the intended pattern for an intermediary funding a UTXO on behalf of a retail user. Awaiting answer.
- **Production scale path for relayer.** Umbra confirmed hackathon demo load is fine; the production path (self-hosted relayer vs. enterprise tier) is still pending.

---

## 10. The test that actually matters

Every hackathon day, before writing a single line of new code, run the hello-world end-to-end in under 2 minutes. If any step fails, fix that before building new features. A broken foundation doesn't get better with more code on top.

Day 1 baseline (close-of-day, on Starlink, against Helius mainnet):

- Registration → ✓ (one-time, both keypairs)
- UTXO creation → ✓ (treasury-funded, public→receiver)
- Scanner → ✓ (correctly buckets `publicReceived`)
- Claim → ✓ (gasless via relayer, on-chain tx confirmed)

Reference tx signatures kept as proof points: see section 9 above.

---

## 11. Lessons that don't fit anywhere else

A few things from Day 1 that aren't rules but should shape how we work in Sprint 1+:

**The user knows the dev environment better than the assistant.** When the human says *"I just changed X, let's see if Y works,"* that's a data point worth taking seriously — not impulse to dismiss. On Day 1, switching ISPs to Starlink fixed the claim error after I'd argued (confidently and incorrectly) that home network couldn't be the cause. The correct response to "let's just try it" on a $0 test is *"sure, go,"* not *"my hypothesis says no."*

**Confidence calibration matters as much as accuracy.** A wrong confident answer wastes more time than a right cautious one, because it makes the human stop questioning. When ruling out hypotheses, label them as "ruled out" only when there's actual evidence — not when they "shouldn't" matter on theoretical grounds.

**The last mile is where the undocumented behavior lives.** Registration, creation, scanning — all worked with minor doc drift. The claim — the one step where the on-chain program runs protocol-level checks against our submission — is where the surprise lived. Bake this into Sprint 2-3 schedules: budget extra time for the *final* step of any new flow, not the first.

**Network quality is a variable, not a constant.** "It worked on my machine" hides ISP-level effects. For anything time-sensitive (proofs, blockhashes, signed transactions with TTLs), assume the user might be on a degraded network and design the error path accordingly.
