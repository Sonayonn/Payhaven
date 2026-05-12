<p align="center">
  <img src="docs/media/logo.png" alt="Payhaven logo" width="120" />
</p>

<h1 align="center">Payhaven</h1>

<p align="center">
  <strong>Private USDC remittance for the Nigerian diaspora.</strong>
</p>

<p align="center">
  Live on Solana mainnet at <a href="https://payhaven.net">payhaven.net</a> · Built on <a href="https://docs.umbraprivacy.com">Umbra</a> · Solo-developed for the <a href="https://colosseum.com">Solana Frontier Hackathon</a>
</p>

---

## The problem this solves

In 2024, Nigeria received **$20.98 billion** in remittances — its highest in five years.<sup>[1]</sup>

The same year, the country recorded **2.2 million kidnappings**, **91% of which were for ransom**.<sup>[2]</sup>

These two numbers are connected. Wallet surveillance tools combined with a single KYC leak are enough for criminals to identify, profile, and target the families receiving foreign money. A grandmother in Lagos receiving $200 from her son abroad becomes a known data point in someone else's database — and known data points become targets.

Existing crypto remittance apps (Surgepay, Chipper Cash, Yellow Card) solved cost and speed. They left **privacy fully visible**. Western Union charges 5-7%; the new generation charges 1-2% but ships every transfer onto a public ledger forever. Cheap and fast, but exposed.

Payhaven is the first private USDC remittance product designed for this audience. Encrypted on-chain. No public footprint. Recipients claim with just an email or phone number.

### Target users

- **Diaspora senders** in the UK, US, Canada, and Germany sending money to family in Nigeria — currently paying 5-7% to Western Union
- **Recipients in Nigeria** — often non-technical, often older, who need to receive money safely without learning crypto, managing seed phrases, or being visible on a public ledger
- **Compliance-required senders** (accountants, businesses, regulated entities) who need privacy by default but scoped disclosure on demand — handled via the viewing-key system

### Use cases

- A son in London sending $400 to his mother in Lagos for school fees — encrypted on-chain, recipient claims with her email
- A daughter in Toronto sending recurring $200 monthly to her parents — neither the amount nor the recipient pattern visible on-chain
- A diaspora professional sending to multiple family members across Nigeria — each transfer hidden, but viewing key grants on-demand audit trails for tax filing
- A small business paying contractors in Nigeria privately — B2B private payroll without exposing payment patterns to competitors

---

## How Payhaven uses the Umbra SDK

Umbra is the privacy substrate underneath every value-moving operation in Payhaven. The integration is end-to-end, not a feature bolt-on. Every primitive in the user journey is an Umbra SDK call.

### Integration architecture

When a sender funds their Payhaven wallet with public USDC, they tap **Shield**, which calls `getPublicBalanceToEncryptedBalanceDirectDepositorFunction` to move that USDC into Umbra's encrypted pool. The on-chain `EncryptedUserAccount` PDA holds the resulting encrypted balance.

When that sender wants to transfer privately, they tap **Send privately**. The flow:

1. Server-side Privy-signed Umbra client is initialized for the sender
2. We call `getUserRegistrationFunction` (idempotent — skips already-completed steps) to ensure both sender and recipient have on-chain Umbra accounts with X25519 keys and Poseidon commitments registered
3. `getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction` is invoked, which generates a ZK proof and submits the encrypted-balance-to-claimable-UTXO transaction via Umbra's relayer. The amount and recipient address are encrypted on-chain.
4. The resulting `create_utxo_signature` is stored in our `claim_tokens` table alongside the recipient's email/phone identifier
5. The sender sees a WhatsApp/SMS/email-shareable claim link; the link contains an unguessable 32-byte token tied to the UTXO

When the recipient opens the claim link and authenticates with Privy (using the matching email/phone):

1. We verify their identity matches the `recipient_identifier` in the claim token
2. Server-side Umbra client is initialized for the recipient's pregenerated wallet
3. `getClaimableUtxoScannerFunction` scans the on-chain Merkle tree for UTXOs addressed to this recipient
4. `getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction` (with `getBatchMerkleProofFetcher` injected per the SDK's dependency-injection pattern) generates the claim ZK proof and submits it via the relayer
5. The UTXO drains into the recipient's encrypted balance, claimable via a future unshield

When either party wants to convert back to public USDC, **Unshield** calls `getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction`.

For compliance, **Layer B** uses Umbra's viewing-key system: `getViewingKeyGeneratorFunction` produces X25519 grants with scoped permissions (specific time window, specific transactions) that the user can hand to their accountant, tax authority, or a regulator with a warrant — without revealing the rest of their financial history.

### Key implementation decisions

- **Server-owned Privy embedded wallets:** Each user's Umbra client is built with a server-side Privy signer (`getPrivyUmbraClient`). Recipients without prior accounts get a pregenerated Solana wallet at send-time; when they later log in, the system adopts that wallet rather than minting a new one (the "same email → same wallet" guarantee).
- **Treasury-sponsored registration gas:** Recipient wallets are funded with ~0.015 SOL by the treasury before their first Umbra registration, so recipients never need to acquire SOL.
- **FIFO/LIFO drain strategy:** When a recipient has multiple queued UTXOs (e.g., several pending sends), we drain one per API call to stay within Vercel function memory limits (~1GB per ZK proof). The frontend polls until the queue is empty.
- **Memory-bounded claims:** Each ZK proof generation spikes RAM by ~500MB-1GB; single-UTXO-per-call is the only architecture that fits Vercel Hobby's 1024MB ceiling without OOM crashes.
- **Strict-contract claim wrapper:** Our `claimReceiverUtxo` function enforces that either signatures are returned OR an explicit `ClaimNotSubmittedError` is thrown — never silent failure, never optimistic DB updates.

The Umbra SDK does the heavy cryptographic lifting (Arcium MPC, Groth16 ZK proofs, Poseidon commitments, X25519 key derivation). Payhaven provides the consumer-grade UX, recipient-claimable abstraction, and the orchestration glue.

---

## What's shipped

Live on Solana mainnet today:

- **Shield** — move public USDC into the encrypted pool
- **Encrypted-balance send** — fully private transfers; amount and recipient hidden on-chain
- **Receiver-claimable UTXO claim** — recipients with no prior wallet can claim via WhatsApp/email link
- **Unshield** — withdraw from encrypted pool back to public balance
- **Compliance Layer B** — X25519 viewing key generation with scoped, revocable grants
- **Closed-beta invite system** with dedicated codes for hackathon judges
- **Mobile + desktop responsive UI** with light/dark mode
- **Custom domain + SSL** at payhaven.net

The full privacy lifecycle settles end-to-end in **~13 seconds** on Solana mainnet.

---

## Deployed addresses and program IDs

| Item | Value |
|---|---|
| **Frontend** | [payhaven.net](https://payhaven.net) |
| **Network** | Solana mainnet-beta |
| **Umbra Mixer program ID** | `UMBRAD2ishebJTcgCLkTkNUx1v3GyoAgpTRPeWoLykh` |
| **GitHub** | [github.com/Sonayonn/Payhaven](https://github.com/Sonayonn/Payhaven) |
| **Stablecoin** | USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) |


### Verified mainnet transaction signatures

All four privacy primitives have verified Solscan-readable signatures:

| Operation | Signature |
|---|---|
| Encrypted-balance send | [`GSzCiWe7TsRDy3MQ8xaaAMof69ik17e4GxEpnsF6veuaibCckP33k9Dt1i6nMrVGR3Pqf7kNaPWr8ejUA2FHhou`](https://solscan.io/tx/GSzCiWe7TsRDy3MQ8xaaAMof69ik17e4GxEpnsF6veuaibCckP33k9Dt1i6nMrVGR3Pqf7kNaPWr8ejUA2FHhou) |
| Unshield | [`3yBrNJF2U7v2xRo17RgLTMzxd8LLymNVbANLrtiSMTZi7RRJKgmuXTpNzEZjrJFYWkEfvenDoB4g9rSuSzoU72tr`](https://solscan.io/tx/3yBrNJF2U7v2xRo17RgLTMzxd8LLymNVbANLrtiSMTZi7RRJKgmuXTpNzEZjrJFYWkEfvenDoB4g9rSuSzoU72tr) |
| Receiver-claimable UTXO claim (fresh recipient) | [`4d3SGeLDfMxXxagFJWuoMt71yVW2ZyRq7iWzA59g5MXrtPPjWd8Yh3DbSTvaSLzAMK8zUXJXcsSpvoJGkxz4PKzJ`](https://solscan.io/tx/4d3SGeLDfMxXxagFJWuoMt71yVW2ZyRq7iWzA59g5MXrtPPjWd8Yh3DbSTvaSLzAMK8zUXJXcsSpvoJGkxz4PKzJ) |
| Receiver-claimable UTXO claim ($20 drain) | [`GEwzCmvuCYrfvniytWVs1v6gJfWJxQvFAdt3q5ZBxmK9779G6qTMBEhfX48Z9kWAYHZFsjTYYoceiT58XetRsgK`](https://solscan.io/tx/GEwzCmvuCYrfvniytWVs1v6gJfWJxQvFAdt3q5ZBxmK9779G6qTMBEhfX48Z9kWAYHZFsjTYYoceiT58XetRsgK) |
| Earlier successful recipient drain | [`2eVBALZ1dZd8BUBZYfaBYA6VD7FpMpSYTvuT6CXxwFdbtVeqgacdFB1dQbKqtU4ZmV7jNZQ4kqiMvny913pTrvsX`](https://solscan.io/tx/2eVBALZ1dZd8BUBZYfaBYA6VD7FpMpSYTvuT6CXxwFdbtVeqgacdFB1dQbKqtU4ZmV7jNZQ4kqiMvny913pTrvsX) |

Every transaction is verifiable on Solscan. Not testnet.

---

## How to build

Payhaven is a Next.js 16 application. No on-chain Anchor program to compile — Umbra's program is already deployed.

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (free tier works)
- Helius RPC endpoint (free tier works)
- Privy app (free tier works)
- A Solana wallet with ~0.5 SOL for the treasury (mainnet)

### Steps

```bash
# 1. Clone
git clone https://github.com/Sonayonn/Payhaven
cd Payhaven

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Helius RPC URL, Supabase keys, Privy keys, and
# the base58 secret key for the treasury wallet

# 4. Run database migrations
# In your Supabase SQL Editor, run the files in supabase/migrations/ in order

# 5. Generate invite codes for testing (optional)
# Run the SQL in scripts/seed-invite-codes.sql

# 6. Start the dev server
npm run dev
# Open http://localhost:3000
```

### Required environment variables

| Variable | Purpose |
|---|---|
| `SOLANA_RPC_URL` | Helius mainnet RPC endpoint |
| `SOLANA_WS_URL` | Helius WebSocket endpoint |
| `TREASURY_SECRET_KEY_B58` | Base58 secret key for the gas-sponsor wallet |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app ID |
| `PRIVY_APP_SECRET` | Privy server secret |
| `PRIVY_AUTHORIZATION_KEY` | Privy server-wallets authorization private key |
| `PRIVY_AUTHORIZATION_PUBLIC_KEY` | Privy authorization public key (used as `ownerId`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-only) |
| `NEXT_PUBLIC_APP_URL` | Public origin (e.g., `http://localhost:3000` or `https://payhaven.net`) |

### Production build

```bash
npm run build
npm run start
# Or deploy directly to Vercel — auto-deploys from `main`
```

---

## How to test

Test coverage focuses on the financial primitive (`money.ts`) — base-unit conversions, precision handling, and amount parsing — to prevent the class of bugs that lose users' funds. Broader integration tests are Sprint 3 work.

```bash
# Run the test suite
npm run test

# TypeScript type checking (no runtime tests, just compile-time correctness)
npx tsc --noEmit

# Linting
npm run lint
```

### Manual end-to-end testing

Because the privacy stack depends on Solana mainnet, Umbra's relayer, and ZK proof generation, end-to-end testing requires a real environment. The flow:

1. Run the app locally with mainnet RPC configured
2. Sign in with an email you control → you receive a pregenerated Solana wallet
3. Fund the wallet with a small amount of mainnet USDC (any Solana wallet)
4. Tap **Shield** on the Public tab — confirm the balance moves to the encrypted pool
5. Switch to **Private** tab → **Send privately** → enter a different email and an amount
6. Open the claim link in another browser → sign in as the recipient → tap claim
7. Verify the recipient's encrypted balance updates
8. Test unshield by tapping **Cash Out → Withdraw to public** (when wired up) — or by directly calling `/api/unshield`

Every step writes a real transaction to Solana mainnet. Each signature is verifiable on Solscan.

---

## How to use Payhaven (end users)

### As a sender

1. Visit [payhaven.net](https://payhaven.net), enter an invite code
2. Sign in with email or phone — your Solana wallet is created automatically
3. Fund the wallet with USDC (visible deposit address on the Public tab) and sol for gas
4. Tap **Shield** to move USDC into the encrypted pool — the balance moves to your Private tab
5. Tap **Send privately**, enter the recipient's email or phone, and the amount
6. Share the generated claim link via WhatsApp, SMS, or email

### As a recipient

1. Open the claim link the sender shared with you
2. Sign in with the email or phone the link was addressed to
3. Tap **Claim** — your USDC arrives in your private Payhaven balance
4. From there, you can send privately to someone else, or unshield to withdraw publicly

No seed phrases. No wallet apps. No SOL required to claim (gasless via Umbra's relayer).

### For compliance (optional)

Generate a viewing key in Settings → **Compliance & Audit**. Grants are scoped to specific time windows and revocable at any time. Share the key with your accountant or auditor; they can decrypt the transactions you've authorized, nothing more.

---

## For hackathon judges

Payhaven is in closed beta to control treasury gas costs during registration. Use any of these invite codes (they all work, and can be re-used):

- **Frontier track:** `JUDGE-FRONTIER-001`, `JUDGE-FRONTIER-002`
- **Umbra track:** `UMBRA-TEAM`, `JUDGES-2026`


---

## What's coming

Honestly tracked roadmap. Nothing hidden.

**Q3 2026 (in progress):**
- **Naira off-ramp** via licensed partnership ( **NOTE**: the Cash Out modal currently is a demo modal, the bank verification is a dummy,and after filling in 10 numbers and clicking verify, takes you to a modal that displays "Coming soon Q3 2026" in product). KYB onboarding underway. You can then cashout by withdrawing to any solana wallet address as an alternative for now.

**Q4 2026:**
- Payhaven for Business (private B2B payroll)
- Native mobile apps (Expo)
- Cross-corridor pilot (Kenya)

**2027:**
- Card issuance with interchange revenue
- White-label privacy infrastructure for African fintechs

---

## Business model

Three streams that compound:

1. **Near-term:** 1-2% FX spread on the Naira off-ramp (vs Western Union's 5-7%) plus $1-3 flat fee on transfers >$100
2. **Mid-term:** float yield on aggregate encrypted balances (4-5% on AUM — same engine that powers Cash App's revenue inside Block's $40B valuation)
3. **Long-term:** B2B privacy infrastructure — every African fintech adding confidential payments licenses the Payhaven stack

The defensible advantage across all three is trust. Privacy is a category where users don't switch back once they've adopted.

---


## Sources

[1] Central Bank of Nigeria, reported by BusinessDay: [Remittances hit $20.93bn: Highest in 5 yrs](https://punchng.com/personal-remittances-hit-20-93bn-in-2024-cbn-2/)

[2] Nigeria Bureau of Statistics, *Crime Experience and Security Perception Survey 2024* (CESPS 2024), reference period May 2023–April 2024, released December 2024.[AllAfrica](https://allafrica.com/stories/202412190012.html).

---


## License

MIT
