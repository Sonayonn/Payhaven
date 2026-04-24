# Architectural debt ledger

Things intentionally left imperfect, with fix plans. Review before every sprint close — don't let this grow faster than we shrink it.

Last updated: Day 8 of Sprint 2 (April 22, 2026)

---

## 🔴 Must fix before public launch with real user funds

These block going live, not building features.

### Treasury is a single hot keypair

- **Where:** `src/lib/umbra/treasury.ts`, `.env.local`
- **Why it's debt:** a server compromise drains the treasury.
- **Fix:** migrate treasury to [Squads](https://squads.so) multi-sig. Hot keypair for day-to-day signing, cold quorum for drain protection.
- **Blocks launch?** Yes.

### No rate limiting on `/api/send`

- **Where:** `src/app/api/send/route.ts`
- **Why it's debt:** spam can burn treasury SOL on failed UTXO creations AND failed recipient registrations (now ~0.01 SOL per unique phone/email triggered, even if the underlying UTXO never gets created).
- **Fix:** add Vercel rate-limit middleware or a global Redis-backed limiter. Tier the limits: per-sender-IP, per-sender-account, and per-recipient-identifier (the last is what stops registration-spam attacks specifically).
- **Blocks launch?** Yes — before any marketing.

### No sender authentication

- **Where:** `src/app/api/send/route.ts`
- **Status:** ✅ Resolved Sprint 1 Day 5 — Privy bearer token verified via `verifyPrivyToken` before any treasury operation.
- **Blocks launch?** No longer.

### No database for claim tokens

- **Where:** `src/lib/claim-tokens/server.ts`, Supabase `claim_tokens` table.
- **Status:** ✅ Resolved Sprint 2 Day 8 — table provisioned with `recipient_wallet_id` and `umbra_registered_at` columns for Day 11 claim flow + repeat-recipient optimization.
- **Blocks launch?** No longer.

### Sender-side custody: treasury still creates the UTXO

- **Where:** `src/app/api/send/route.ts` — UTXO funded from treasury's public USDC balance, not the sender's.
- **Why it's debt:** Recipient-side custody was eliminated by Option B (recipient holds their own pregenerated wallet pre-registered with Umbra), but the sender side still routes through treasury. This makes Payhaven a money transmitter under most regimes — exactly the regulatory exposure we want to avoid at scale.
- **Fix:** Option B-Phase-2: client-side UTXO creation. Sender's Privy wallet calls `getPublicBalanceToReceiverClaimableUtxoCreatorFunction` directly from the browser, with treasury exiting the critical path entirely. Requires sender-side `@umbra-privacy/web-zk-prover` integration in a Web Worker (CPU-heavy — 1-5s proof generation can block the main thread).
- **Blocks launch?** Yes — this is the regulatory cliff. Acceptable for hackathon demo; not acceptable for paying users.
- **Scheduled:** Post-hackathon Sprint 1.

### Recipient registration cost not metered or recovered

- **Where:** `src/lib/umbra/recipient-registration.ts` — treasury funds each new recipient with 0.01 SOL (~$1.50 at current rates) for registration gas.
- **Why it's debt:** At scale this is a real per-acquisition cost. A hostile actor could spam unique phone numbers to drain treasury SOL. The repeat-recipient optimization (`umbra_registered_at` short-circuit) helps for legitimate use but doesn't defend against attack.
- **Fix:** Three layers, in order of priority:
  1. Per-recipient-identifier rate limit (covered under "No rate limiting" above).
  2. Recover unspent SOL from the recipient wallet after registration confirms — only ~0.00015 SOL is actually spent on the 3 txs; the remaining ~0.0085 should sweep back to treasury. Requires constructing a sweep tx signed by the recipient's Privy wallet (server-signable since the user hasn't claimed it yet).
  3. Long-term: amortize registration cost into the send fee (e.g., add 0.05% to the first send to a new recipient).
- **Blocks launch?** Not for closed beta. Yes for public launch with marketing spend.

### Leaking Funds

 "Funded recipient wallets are not swept back to treasury on failed registration." Or at minimum, hardcode the funding amount down to 0.001 SOL while debugging. Three registration txs need ~0.000015 SOL of actual fees; 0.001 is still 60x headroom.

### Privy key

 Privy authorization key is a single hot secret in .env.local — same risk profile as treasury keypair. Should move to a secrets manager (Doppler, AWS Secrets Manager, or similar) before any production deployment.

---

## 🟡 Nice to fix before launch

Not blockers, but would embarrass us if discovered publicly.

### Error messages leak internal details

- **Where:** `apiError(...)` forwards upstream error messages verbatim in dev.
- **Why it's debt:** production responses should be opaque to outside callers.
- **Fix:** in production, return generic `"internal error, request_id: ..."` and only log the detail server-side.
- **Blocks launch?** No, but fix before any public beta.

### No retry logic for the 5-minute freshness window

- **Where:** `src/app/api/send/route.ts`
- **Status:** Confirmed twice in practice — Day 1 (claim step) and Day 3 (UTXO creation from a degraded ISP). Both failed with `stage: transaction-send`, both recovered on Starlink. Now THREE places where this can hit: funding tx, registration txs, and UTXO creation.
- **Why it's debt:** users on flaky mobile data will hit this. Our current response is an opaque 502 with `"fetch failed"`. The new registration step compounds the surface area.
- **Fix:**
  1. Catch `stage: "transaction-send"` in the route handler at every Solana-touching boundary
  2. Return a friendly error code (e.g., `NETWORK_UNSTABLE`) with retry guidance
  3. Client-side retry with exponential backoff (max 2 attempts before asking the user to check their connection)
  4. Server-side: leverage `registerRecipientIfNeeded` idempotency — a retry just resumes from the failed step.
- **Blocks launch?** Yes — demo and real users will see this. Promoted to 🔴 and scheduled for Sprint 2 Day 10.

### Privy adapter typed via `as unknown as IUmbraSigner` cast

- **Where:** `src/lib/umbra/recipient-client.ts`
- **Why it's debt:** Umbra's `SignedTransaction` brand symbol can't be produced through the public `@solana/transactions` encoder/decoder pipeline, so we cast at the boundary. The runtime behavior is correct (signatures merge into the original tx, lifetime constraints preserved) but TypeScript can't verify it.
- **Fix:** open an issue with Umbra to either (a) export the brand utility, or (b) accept a duck-typed signer interface. Until then, the cast is isolated to a single line.
- **Blocks launch?** No.

### `recipient_identifier` lacks an index

- **Where:** `claim_tokens` table.
- **Why it's debt:** repeat-recipient lookup (`SELECT umbra_registered_at FROM claim_tokens WHERE recipient_identifier = $1 ORDER BY created_at DESC LIMIT 1`) is sequential-scan today.
- **Fix:** `CREATE INDEX claim_tokens_recipient_identifier_idx ON claim_tokens (recipient_identifier, created_at DESC);`
- **Blocks launch?** No — fine until ~10K rows.

---

## 🟢 Fine for now, track anyway

Not urgent, but capture so we don't forget.

### Umbra client lazy-loaded per process

- **Where:** `src/lib/umbra/treasury.ts`
- **Status:** intentional. First request in a new server process has a ~1s warmup. If the demo shows a visible lag, pre-warm at app boot.

### Recipient Umbra client built fresh on every send

- **Where:** `src/lib/umbra/recipient-client.ts`
- **Status:** intentional. Caching by `walletId` would save the master-seed derivation round-trip on the second send to the same recipient (~200ms), but invalidation is fiddly and the repeat-recipient short-circuit already skips this entire path. Revisit if profiling shows it.

### Test coverage exists only for `money.ts`

- **Status:** acceptable for Sprint 2. Before Sprint 3 close, add at minimum: integration test for `/api/send` against a mocked treasury client + mocked Privy walletApi, and an integration test for `registerRecipientIfNeeded` idempotency (same input twice → second call short-circuits).

---

## Process

- Every feature merge should either add to this ledger or remove from it.
- Review at the start of each Sprint — if a 🔴 item hasn't moved in 3 days, it's blocking progress and needs to be prioritized.

### Sender-side custody: treasury still creates the UTXO

- **Status:** ✅ Resolved Sprint 2 Day 8. `/api/send` now builds an Umbra client from the sender's own wallet via `getPrivyUmbraClient`, and that wallet signs the UTXO creation. Treasury's role is now purely gas sponsor for new recipients. On-chain graph: `sender → Umbra shielded pool → recipient`. Treasury does not appear in the value transfer path.

---

### Orphaned Privy wallets from Day 8 debug cycles

- **Where:** Multiple dead wallets created during architectural iteration before dedup landed. Partial list:
  - `AJsM7reCjhP27m355kVuijrmacqSQb8KtKKmsAXZTnnL` — ~0.01 SOL stranded
  - `CQSbucnYBDc8GCU9J8i7WA7kvSsiJFjvCGAP18K9p76q` — ~0.01 SOL stranded
  - `7bcVCL2qDXAniTq3KkXYo5yHCp7MVTPPwXwzLf5tNf2N` — ~0.007 SOL stranded (registered, could be reclaimed by manual Supabase insert)
  - `6gpUfTPjJf9HaLV6BmfwtRWN1BKR99v6wLukzbkBbtcn` — ~0.001 SOL
  - `HeotYHGwvJUAzB7ZWJG8wgYUQ6YxFQJcWcHrV5N4GEUD` — ~0.01 SOL
- **Why it's debt:** Total leaked ~0.04 SOL ($6). At production scale, every failed send attempt creates a new orphan.
- **Fix:** Treasury sweep script that iterates `server_wallets` + `claim_tokens`, queries RPC for SOL balances, builds a sweep tx signed by each wallet via Privy walletApi, recovers to treasury. ~60 lines of code.
- **Blocks launch?** No, but needed before public beta so treasury doesn't bleed.
- **Scheduled:** Sprint 3 Day 1.

### Registration retry risks double-registration if SDK idempotency changes

- **Where:** `src/lib/umbra/wallet-registration.ts` — `registerWalletIfNeeded` catches `transaction-send` / `transaction-validate` errors and retries `register()`.
- **Why it's debt:** CONVENTIONS.md §4 states "registration is a one-way door." Our retry only works because Umbra's `register()` is documented as idempotent. If the SDK ever changes that behavior, we'd rotate keys on an already-registered wallet and orphan all UTXOs.
- **Fix:** Add an explicit on-chain account-state pre-check before the retry — if the account's X25519 key is already set, short-circuit and don't call `register()` at all. Requires using `getAccountStateFunction` once it's confirmed exported (it wasn't in our earlier grep, but the registration doc references it).
- **Blocks launch?** Not immediately; current behavior is safe per current SDK version. But pin the SDK version in package.json and audit on any upgrade.