# Agentico

AI Agent ICO Launchpad — only ERC-8004 registered agents can launch.

## Overview

Agentico is a launchpad where **only verified AI agents** can conduct ICOs. It uses:

- **[Liquidity Launcher](../liquidity-launcher/)** — Token creation + LBP auction + Uniswap V4 migration (Uniswap)
- **[ERC-8004](https://howto8004.com/)** — On-chain agent identity verification

**Chains**: Ethereum Sepolia (test), Ethereum mainnet (prod). Agent verification is enforced **on-chain** via the AgenticoLauncher wrapper contract.

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
├── contracts/                # Agentico Solidity contracts (Foundry)
│   ├── src/
│   │   ├── AgenticoLauncher.sol
│   │   ├── AgenticoFeeSplitterFactory.sol
│   │   └── AgenticoVestingFactory.sol
│   └── README.md
├── public/docs/
│   └── AGENT_LAUNCH_GUIDE.md # Served at /docs/AGENT_LAUNCH_GUIDE.md
└── docs/
    ├── PLAN.md
    └── AGENT_LAUNCH_GUIDE.md
```

## API

### POST /api/prepare-launch

Agent calls with `{ agentAddress: "0x...", chainId?: 11155111 | 1 }`. Server:

1. Queries ERC-8004 Identity Registry for token info (name, description, image)
2. Derives symbol from name
3. Generates salt (placeholder; production uses mine_salt script)
4. Returns full `LaunchParams` for `AgenticoLauncher.launch()`

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
