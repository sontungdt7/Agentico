# Fomo4Claw

AI Agent ICO Launchpad — launch tokens via X/Twitter.

## Overview

Fomo4Claw is a launchpad where **anyone can launch tokens** via X/Twitter. It uses:

- **[Liquidity Launcher](../liquidity-launcher/)** — Token creation + LBP auction + Uniswap V4 migration (Uniswap)
- **X/Twitter** — Launch requests via `@fomo4claw_bot !launchcoin` mentions

**Chains**: Ethereum Sepolia (test), Ethereum mainnet (prod). Launches are executed **on-chain** via the Fomo4ClawLauncher contract.

## Docs

- [Implementation Plan](docs/PLAN.md) — Architecture, contract addresses, build steps
- [Agent Launch Guide](docs/AGENT_LAUNCH_GUIDE.md) — How to get token info from ERC-8004

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
Agentico/
├── app/
│   ├── api/prepare-launch/   # POST: fetch ERC-8004 + return LaunchParams
│   ├── launch/               # Launch page (guide link)
│   ├── auctions/             # Auction list + detail
│   ├── profile/              # User launches, bids, claims
│   └── page.tsx              # Landing
├── components/
│   ├── header.tsx
│   └── providers.tsx
├── lib/
│   ├── wagmi.ts              # wagmi config (Sepolia + mainnet)
│   ├── liquidity-launcher.ts # Addresses, LaunchParams types
│   └── utils.ts
├── contracts/                # Fomo4Claw Solidity contracts (Foundry)
│   ├── src/
│   │   ├── AgenticoLauncher.sol (Fomo4ClawLauncher)
│   │   ├── AgenticoFeeSplitterFactory.sol (Fomo4ClawFeeSplitterFactory)
│   │   └── AgenticoAirdrop.sol (Fomo4ClawAirdrop)
│   └── README.md
├── public/docs/
│   └── AGENT_LAUNCH_GUIDE.md # Served at /docs/AGENT_LAUNCH_GUIDE.md
└── docs/
    ├── PLAN.md
    └── AGENT_LAUNCH_GUIDE.md
```

## API

### POST /api/prepare-launch

Accepts token details: `{ name, symbol, wallet, description, image, ... }`. Server:

1. Validates token details
2. Mines salt for LBP hook (if FEE_SPLITTER_FACTORY configured)
3. Returns full `LaunchParams` for `Fomo4ClawLauncher.launch()`

## Contracts

```bash
cd contracts
forge build
```

See [contracts/README.md](contracts/README.md) for integration with liquidity-launcher.

## Links

- [Register your agent](https://howto8004.com/) — ERC-8004 registration
- [8004agents.ai](https://8004agents.ai) — Agent profiles
- [Liquidity Launcher](../liquidity-launcher/) — Smart contracts
