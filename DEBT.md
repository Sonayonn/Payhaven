# Architectural debt ledger

Things intentionally left imperfect, with fix plans. Review before every sprint close — don't let this grow faster than we shrink it.

Last updated: Day 3 of Sprint 1 (April 19, 2026)

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
- **Why it's debt:** spam can burn treasury SOL on failed UTXO creations.
- **Fix:** add Vercel rate-limit middleware or a global Redis-backed limiter.
- **Blocks launch?** Yes — before any marketing.

### No sender authentication

- **Where:** `src/app/api/send/route.ts`
- **Why it's debt:** anyone with the URL can trigger a UTXO creation at treasury expense.
- **Fix:** require a valid Privy session token, bind to sender's KYC'd identity.
- **Blocks launch?** Yes — this is the on-ramp KYC story.
- **Scheduled:** Sprint 1 Day 4-5.

### No database for claim tokens

- **Where:** not yet implemented — API route currently returns raw tx signatures.
- **Why it's debt:** we can't deliver claim links via SMS without persistence.
- **Fix:** Supabase table `claim_tokens (token, commitment_index, expires_at, status)`.
- **Blocks launch?** Yes — the claim link IS the product.
- **Scheduled:** Sprint 2 Day 8.

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
- **Status:** Confirmed twice in practice — Day 1 (claim step) and Day 3 (UTXO creation from a degraded ISP). Both failed with `stage: transaction-send`, both recovered on Starlink.
- **Why it's debt:** users on flaky mobile data will hit this. Our current response is an opaque 502 with `"fetch failed"`.
- **Fix:**
  1. Catch `stage: "transaction-send"` in the route handler
  2. Return a friendly error code (e.g., `NETWORK_UNSTABLE`) with retry guidance
  3. Optional: client-side retry with exponential backoff (max 2 attempts before asking the user to check their connection)
- **Blocks launch?** Yes — demo and real users will see this. Promoting from 🟡 to 🔴 and scheduling for Sprint 2 Day 10 alongside the claim flow.
---

## 🟢 Fine for now, track anyway

Not urgent, but capture so we don't forget.

### Umbra client lazy-loaded per process

- **Where:** `src/lib/umbra/treasury.ts`
- **Status:** intentional. First request in a new server process has a ~1s warmup. If the demo shows a visible lag, pre-warm at app boot.

### Test coverage exists only for `money.ts`

- **Status:** acceptable for Day 3. By end of Sprint 1, `/api/send` needs integration tests against a mocked treasury client.

---

## Process

- Every feature merge should either add to this ledger or remove from it.
- Review at the start of each Sprint — if a 🔴 item hasn't moved in 3 days, it's blocking progress and needs to be prioritized.