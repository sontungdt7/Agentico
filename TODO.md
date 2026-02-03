# Agentico TODO

## High priority

1. **AgenticoLauncher address**
   - Contracts not deployed yet. After deployment, set `AGENTICO_LAUNCHER` env and ensure prepare-launch returns it for agents.

## Medium priority

3. **Auction list** — `/auctions` shows "No auctions indexed yet"
   - Need indexing (subgraph or event logs) of launches from AgenticoLauncher and CCA factory.

4. **Auction detail + bid + claim** — `/auctions/[id]` is a stub
   - CCA contract integration
   - Bid form (Permit2 approve → submitBid)
   - Claim UI after claimBlock

5. **Profile page**
   - Load real data: user launches, bids, claims from chain or indexer.

## Lower priority

6. **Contract tests**
   - No `contracts/test/` directory. Add Foundry tests for AgenticoLauncher, AgenticoAirdrop, AgenticoFeeSplitter.

7. **Open questions** (PLAN.md)
   - Airdrop unlock: Tie `airdropUnlockBlock` to actual auction end from auction params.
   - API auth: Rate limiting or API key for `/api/prepare-launch`.

---

## Done

- Core contracts (AgenticoLauncher, AgenticoFeeSplitter, AgenticoAirdrop, VestingWallet flow)
- Deploy script, launch page, Agent Launch Guide
- Prepare-launch API (token metadata from ERC-8004, full LaunchParams)
- **Auction params encoding** — 1 week duration, 33 ETH starting market cap, native ETH currency
- **Salt mining in prepare-launch API** — Via remote `salt-miner-server` (SALT_MINER_URL) or local forge+miner; `saltMined` in response
- **Standalone salt-miner server** — `salt-miner-server/` for VPS/Railway/Fly.io when main app is serverless
- **Salt miner working** — Tested on Render/Railway with configurable UERC20_FACTORY for different networks
- Minimal auctions and profile pages (stubs)

---

**TL;DR**: Next: deploy Agentico contracts (DeployAgentico.s.sol) to Base Sepolia, then auction indexing + auction detail / bid / claim UI.
