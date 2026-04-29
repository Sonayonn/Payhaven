# Payhaven

Privacy-first USDC remittance for Nigeria. Built on Solana + [Umbra SDK](https://sdk.umbraprivacy.com).

Diaspora workers send USDC to family without exposing recipient addresses, amounts, or balance history on-chain. On-chain surveillance plus a single KYC leak can turn regular foreign remittances into a kidnapping risk in Nigeria; Payhaven routes every send through Umbra's shielded pool so that link is broken.

## Status

Work in progress. Built for the [Frontier Hackathon](https://colosseum.com/frontier) (April 6 – May 11, 2026) Umbra Side Track.

## Stack

- **Next.js 14** App Router, TypeScript, Tailwind CSS
- **[Umbra SDK](https://sdk.umbraprivacy.com)** on Solana mainnet for the privacy layer (mixer, encrypted accounts, gasless claims, selective disclosure)
- **[Privy](https://privy.io)** for phone-number auth + embedded Solana wallets
- **[Helius](https://helius.dev)** for Solana RPC
- Twilio for SMS notifications
- Supabase for claim-link metadata (never secrets)

## Architecture

See [`docs/architecture.svg`](./docs/architecture.svg) (added in Sprint 2).

At the high level: sender's USDC hits a Payhaven treasury via a normal SPL transfer, treasury creates a receiver-claimable UTXO in Umbra's mixer pool for the actual recipient, recipient claims via an SMS link. No on-chain link between sender and recipient beyond a generic "deposited to the mixer" action.

## Development

Requires Node.js 20.18+.

```bash
npm install
cp .env.example .env
# fill in .env with your Privy, Helius, Supabase keys
npm run dev
```

## Conventions

See [`CONVENTIONS.md`](./CONVENTIONS.md), hard rules for working on this codebase, including Umbra SDK gotchas, money validation, and secret handling.

## License

MIT (pending, will be added before hackathon submission).
