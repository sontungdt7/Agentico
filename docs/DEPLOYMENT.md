# Fomo4Claw Deployment Guide

This guide covers deploying Fomo4Claw contracts and salt mining for LBP launches.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Rust](https://rustup.rs/) (for salt miner)
- [liquidity-launcher](https://github.com/Uniswap/liquidity-launcher) cloned as a sibling of Agentico (see [contracts/README.md](../contracts/README.md))

## 1. Deploy Fomo4Claw Contracts

Deploy to Ethereum Sepolia:

```bash
cd contracts
export PRIVATE_KEY=0x...
export RPC_URL=https://rpc.sepolia.org  # or your Sepolia RPC

forge script script/DeployAgentico.s.sol:DeployFomo4Claw --rpc-url "$RPC_URL" --broadcast -vvvv
```

Record the deployed addresses:

- **Fomo4ClawLauncher**
- **Fomo4ClawFeeSplitterFactory**
- **Fomo4ClawAirdrop**

Update `lib/liquidity-launcher.ts` and your frontend with the Fomo4ClawLauncher address. For API salt mining, set `FOMO4CLAW_LAUNCHER` and `FEE_SPLITTER_FACTORY` env vars on the server.

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
- `FOMO4CLAW_LAUNCHER` (or `AGENTICO_LAUNCHER` for backward compat) — Deployed Fomo4ClawLauncher address
- `AGENT_ADDRESS` — Wallet that will call `launch()` (the token creator)
- `FEE_SPLITTER_FACTORY` — Deployed Fomo4ClawFeeSplitterFactory address

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
3. **On the salt-miner server**, set **`UERC20_FACTORY`** for the chain you mine for (the GetInitCodeHash script calls this contract; wrong address = "call to non-contract address"):
   - **Ethereum Sepolia (chainId 11155111):** `UERC20_FACTORY=0x0cDE87c11b959E5eB0924c1abF5250eE3f9bD1B5`
   - **Base Sepolia (chainId 84532):** `UERC20_FACTORY=0xD97d0c9FB20CF472D4d52bD8e0468A6C010ba448`

The prepare-launch API sends the correct `uerc20Factory` per chain in the request when you use chainId 11155111 or 84532; if the request omits it, the miner uses its `UERC20_FACTORY` env. Response includes `saltMined: true` when successful.

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

**Salt and token name/symbol must match.** The salt is mined for a specific `(tokenName, tokenSymbol)`; the LBP init code hash depends on the token address, which depends on name/symbol. If you mine salt with `TOKEN_NAME=Agent 1`, `TOKEN_SYMBOL=AGNT1` but then launch with `launchParams.name = "Agent 195"`, `launchParams.symbol = "AGNT195"`, the salt is wrong and the launch can fail or behave incorrectly. **Use prepare-launch in one shot:** it gets name/symbol from ERC-8004, mines salt with those, and returns launchParams with that name, symbol, and salt so they are always consistent. Do not mix salt from a manual miner run with launch params from a different source.

`migrationBlock`, `sweepBlock`, and `airdropUnlockBlock` are derived from `CURRENT_BLOCK` in the script. If mining and launch are far apart, re-mine with a fresh `CURRENT_BLOCK`.

---

## 4. Test launch on Sepolia

End-to-end flow: register a wallet as an AI agent on ERC-8004, then from that wallet call `AgenticoLauncher.launch()` using params from the prepare-launch API.

### Step 1: Register wallet as agent (ERC-8004)

The wallet that will call `launch()` must hold an ERC-8004 identity NFT. You can either:

- **Option A — Script:** Use the RegisterAgentSepolia script (requires the registry to allow public registration):

  ```bash
  cd contracts
  export PRIVATE_KEY=0x...   # Wallet that will be the agent (and will call launch)
  export RPC_URL=https://rpc.sepolia.org
  export AGENT_URI="https://your-domain.com/agent.json"   # IPFS or HTTPS JSON (name, description, image, endpoints)

  forge script script/RegisterAgentSepolia.s.sol:RegisterAgentSepolia --rpc-url "$RPC_URL" --broadcast -vvvv
  ```

  The ERC-8004 registry at `0x7177a6867296406881E20d6647232314736Dd09A` must expose a `register(string uri)` function that mints to `msg.sender`. If your deployment uses a different interface or access control, register via [8004agents.ai](https://8004agents.ai) or the registry’s frontend instead.

- **Option B — Frontend:** Register the same wallet via [8004agents.ai](https://8004agents.ai) or another ERC-8004 dapp, then continue to Step 2.

### Step 2: Get LaunchParams from prepare-launch API

Call your app’s prepare-launch endpoint with the **same** wallet address (the one that holds the ERC-8004 identity and will call `launch()`). Save the full response to a file:

```bash
# Replace with your app URL and the agent wallet address
curl -X POST https://your-app.vercel.app/api/prepare-launch \
  -H "Content-Type: application/json" \
  -d '{
    "agentAddress": "0xYourAgentWallet",
    "chainId": 11155111,
    "agenticoLauncherAddress": "0x867038c4b23A7f26c67C4c368d4ab60ba97e598b"
  }' > launch-params.json
```

Use your deployed AgenticoLauncher address (e.g. `0x867038c4b23A7f26c67C4c368d4ab60ba97e598b`). The response must contain `launchParams` (name, symbol, tokenMetadata, auctionParams, salt, etc.). Do not edit the file; use it as-is for Step 3.

### Step 3: Call launch from that wallet

Run the LaunchFromParamsSepolia script with the JSON file and the same `PRIVATE_KEY` as the agent wallet:

```bash
cd contracts
export PRIVATE_KEY=0x...   # Same wallet as in Step 1 and Step 2
export RPC_URL=https://rpc.sepolia.org
export AGENTICO_LAUNCHER=0x867038c4b23A7f26c67C4c368d4ab60ba97e598b
export LAUNCH_PARAMS_JSON=./launch-params.json

forge script script/LaunchFromParamsSepolia.s.sol:LaunchFromParamsSepolia --rpc-url "$RPC_URL" --broadcast -vvvv
```

The script reads `launchParams` from the JSON and calls `AgenticoLauncher(AGENTICO_LAUNCHER).launch(params)`. Ensure the prepare-launch response was saved with the same structure (root object with a `launchParams` key).

### Summary

| Step | What | Script / API |
|------|------|--------------|
| 1 | Register wallet as AI agent on Sepolia | `RegisterAgentSepolia.s.sol` or 8004agents.ai |
| 2 | Get LaunchParams (token info, salt, auction params) | `POST /api/prepare-launch` → save to `launch-params.json` |
| 3 | Execute launch from agent wallet | `LaunchFromParamsSepolia.s.sol` with `LAUNCH_PARAMS_JSON` |

---

## 5. Troubleshooting

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

### "script failed: &lt;empty revert data&gt;" at createToken

The revert happens inside `UERC20Factory.createToken`. **Most likely cause:** the token for this agent (name/symbol from ERC-8004, e.g. "Agent 196" / "AGNT196") was **already deployed** in a previous launch. The token address is deterministic (CREATE2: same name, symbol, recipient, graffiti → same address). A second launch with the same agent tries to deploy to the same address and reverts.

**What to do:**

1. **Retry with a new agent:** Register a different wallet on ERC-8004 (or use an agent that has never launched), then run prepare-launch and launch again. Each agent gets a unique name/symbol (e.g. Agent 197 / AGNT197), so the token address is different.
2. **Confirm existing token:** On Sepolia Etherscan, look up the token by calling `UERC20Factory.getUERC20Address("Agent 196", "AGNT196", 18, <AgenticoLauncher>, <graffiti>)` (graffiti = `LiquidityLauncher.getGraffiti(AgenticoLauncher)`). If that address has code, the token already exists and you cannot launch again with the same agent unless the launch flow supports “re-launch” (it does not by default).
