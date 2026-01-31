# Agentico Deployment Guide

This guide covers deploying Agentico contracts and salt mining for LBP launches.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Rust](https://rustup.rs/) (for salt miner)
- [liquidity-launcher](https://github.com/Uniswap/liquidity-launcher) cloned as a sibling of Agentico (see [contracts/README.md](../contracts/README.md))

## 1. Deploy Agentico Contracts

Deploy to Ethereum Sepolia:

```bash
cd contracts
export PRIVATE_KEY=0x...
export RPC_URL=https://rpc.sepolia.org  # or your Sepolia RPC

forge script script/DeployAgentico.s.sol:DeployAgentico --rpc-url "$RPC_URL" --broadcast -vvvv
```

Record the deployed addresses:

- **AgenticoLauncher**
- **AgenticoFeeSplitterFactory**
- **AgenticoAirdrop**

Update `lib/liquidity-launcher.ts` and your frontend with the AgenticoLauncher address. For API salt mining, set `AGENTICO_LAUNCHER` and `FEE_SPLITTER_FACTORY` env vars on the server.

---

## 2. Salt Mining for LBP Launches

LiquidityLauncher requires a valid **Create2 salt** so the deployed FullRangeLBPStrategy address is a valid Uniswap v4 hook. Random salts will revert with `HookAddressNotValid`.

### Why Salt Mining?

The LBP strategy is deployed via CREATE2. Its address must satisfy Uniswap v4’s hook permissions mask. Salt mining searches for a salt that produces such an address.

### Build the Address Miner

```bash
cd contracts/script/saltGenerator
cargo build --release
```

### Run Salt Mining (Per Launch)

**Required env:**

- `PRIVATE_KEY` — For forge script (not used for mining)
- `AGENTICO_LAUNCHER` — Deployed AgenticoLauncher address
- `AGENT_ADDRESS` — Wallet that will call `launch()` (the agent)
- `FEE_SPLITTER_FACTORY` — Deployed AgenticoFeeSplitterFactory address

**Optional env:**

- `RPC_URL` — Default: `https://rpc.sepolia.org`
- `FEE_SPLITTER_FACTORY_NONCE` — Current nonce of FeeSplitterFactory (default: 0 for first launch)
- `CURRENCY` — Auction currency (default: native ETH, address(0))
- `TOKEN_NAME`, `TOKEN_SYMBOL` — Must match what will be used in the launch

**Important:** The params used for salt mining must match the launch. Different token name/symbol, currency, or auction params require a new salt.

```bash
cd contracts

export PRIVATE_KEY=0x...
export AGENTICO_LAUNCHER=0x...   # From step 1
export AGENT_ADDRESS=0x...       # Agent wallet (ERC-8004 holder)
export FEE_SPLITTER_FACTORY=0x... # From step 1

# For first launch, nonce is 0. For subsequent launches, fetch:
# export FEE_SPLITTER_FACTORY_NONCE=$(cast nonce $FEE_SPLITTER_FACTORY --rpc-url $RPC_URL)

source script/mine_salt_sepolia.sh
# Outputs: export CURRENT_BLOCK=... and export SALT=0x...
```

The script prints `SALT` and `CURRENT_BLOCK`. Use these in your launch params.

### Flow

1. **GetInitCodeHashSepolia** — Forge script computes the init code hash for FullRangeLBPStrategy with your launch params.
2. **address-miner** — Finds a salt so the CREATE2 address satisfies the hook mask.
3. Output — Use `SALT` in `LaunchParams` when calling `AgenticoLauncher.launch()`.

### prepare-launch API integration (salt mining)

The `POST /api/prepare-launch` endpoint mines salt when:

- `AGENTICO_LAUNCHER` and `FEE_SPLITTER_FACTORY` env vars are set
- Chain is Sepolia (`chainId === 11155111`)

**With a separate salt-miner server** (recommended for Vercel/serverless):

1. Deploy the [salt-miner-server](../salt-miner-server/) to Railway, Fly.io, or a VPS (see its README).
2. On your main app (Vercel), set:
   - `SALT_MINER_URL` — Base URL of the salt-miner server (e.g. `https://salt-miner.railway.app`)
   - `SALT_MINER_API_KEY` — Optional; if you secure the miner with an API key, set the same here
   - `FEE_SPLITTER_FACTORY` — Required (passed to the miner in requests)

The prepare-launch API will call your salt-miner server and return the mined salt. Response includes `saltMined: true` when successful.

**Self-hosted (no separate server):** If your main app runs on a VPS with forge and the address-miner installed, salt mining runs locally. Do not set `SALT_MINER_URL`.

**Fallback:** If neither the salt-miner server nor local mining is available, the API returns a random salt and `saltMined: false`. Use `mine_salt_sepolia.sh` manually for production LBP.

---

## 3. Launch Params Alignment

Salt mining uses the same logic as `launch()`. Ensure:

| Param | Must match |
|-------|------------|
| `TOKEN_NAME`, `TOKEN_SYMBOL` | What the agent will use (from ERC-8004 or prepare-launch) |
| `AGENT_ADDRESS` | `msg.sender` of `launch()` |
| `CURRENCY` | Same as in `LaunchParams.currency` |
| `FEE_SPLITTER_FACTORY_NONCE` | FeeSplitterFactory nonce at launch time |
| `CURRENT_BLOCK` | Block when the launch tx will be mined (or earlier) |

`migrationBlock`, `sweepBlock`, and `airdropUnlockBlock` are derived from `CURRENT_BLOCK` in the script. If mining and launch are far apart, re-mine with a fresh `CURRENT_BLOCK`.

---

## 4. Troubleshooting

### "HookAddressNotValid"

Salt does not produce a valid hook address. Re-run the miner; it can take a few seconds to find a valid salt.

### "Could not extract SEPOLIA_INIT_CODE_HASH"

- Confirm all required env vars are set.
- Run with `-vvvv` to inspect Forge output:  
  `forge script script/GetInitCodeHashSepolia.s.sol:GetInitCodeHashSepolia --rpc-url $RPC_URL -vvvv`

### "Build the address miner first"

```bash
cd contracts/script/saltGenerator
cargo build --release
```

### Wrong init code hash

If token name/symbol, currency, or other launch params differ from the mined params, the init code hash will not match and the salt will be invalid. Re-mine with the correct params.
