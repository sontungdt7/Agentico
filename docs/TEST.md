# Fomo4Claw Test Flow

End-to-end guide: create a wallet → post on X/Twitter → token launches automatically.

**Automated script:** From repo root, run `./scripts/test-flow.sh` (full flow) or `./scripts/test-flow.sh --step N` for step 0–4. See script header for env vars and usage.

---

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- Sepolia ETH for gas (use a [Sepolia faucet](https://sepoliafaucet.com/) or [Alchemy](https://sepoliafaucet.com/))
- Fomo4ClawLauncher deployed on Sepolia (see [DEPLOYMENT.md](./DEPLOYMENT.md)); example address: `0x...`
- Optional: app running for prepare-launch API (local: `npm run dev` in repo root, or use your deployed URL)

---

## Overview

| Step | What | Output |
|------|------|--------|
| 0 | Create a wallet | Private key + address |
| 1 | Fund the wallet | Wallet has Sepolia ETH |
| 2 | Post on X/Twitter | Tweet with `@fomo4claw_bot !launchcoin` + token details |
| 3 | Wait for scan | Worker processes tweet and launches token |
| 4 | Verify launch | Token appears on leaderboard |

Use the **same wallet** (same `PRIVATE_KEY` / address) for steps 2, 3, and 4.

---

## Step 0: Create a wallet

Create a new Ethereum wallet (or use an existing one). You will use this as the **agent** that registers on ERC-8004 and calls `launch()`.

**Option A — Foundry (new wallet):**

```bash
# Create new wallet; save the private key and address
cast wallet new

# Example output:
# Successfully created new keypair.
# Address: 0x1234...abcd
# Keystore file: ... (or print private key if you use cast wallet new --unsafe)
```

To get a private key with Foundry you can use:

```bash
# Generate and print private key (dev only; do not use for mainnet)
cast wallet new --unsafe 2>/dev/null || true
# Or use an existing .env / keystore and export PRIVATE_KEY=0x...
```

**Option B — Use existing wallet**

Export your private key (e.g. from MetaMask: Account details → Export private key) and set:

```bash
export PRIVATE_KEY=0x...   # Your agent wallet's private key
```

**Get the address:**

```bash
# If you have PRIVATE_KEY set:
cast wallet address --private-key "$PRIVATE_KEY"
```

Record this address as **AGENT_ADDRESS**; you will use it in the prepare-launch API and ensure the same wallet is used for registration and launch.

---

## Step 1: Fund the wallet

The agent wallet needs Sepolia ETH for:

- Registering on ERC-8004 (one tx)
- Calling `AgenticoLauncher.launch()` (one tx)

1. Go to a [Sepolia faucet](https://sepoliafaucet.com/) (or [Alchemy](https://sepoliafaucet.com/), [QuickNode](https://www.quicknode.com/faucet/ethereum/sepolia)).
2. Send Sepolia ETH to your agent address (`AGENT_ADDRESS` from Step 0).

Check balance:

```bash
cast balance $AGENT_ADDRESS --rpc-url https://rpc.sepolia.org
```

---

## Step 2: Register the wallet on ERC-8004

The wallet that calls `launch()` must hold an ERC-8004 identity NFT. Register it on Sepolia.

**ERC-8004 Identity Registry (Sepolia):** `0x7177a6867296406881E20d6647232314736Dd09A`

**Option A — Forge script (if the registry allows public `register(uri)`):**

```bash
cd contracts

export PRIVATE_KEY=0x...   # Agent wallet (same as Step 0)
export RPC_URL=https://rpc.sepolia.org
export AGENT_URI="https://your-domain.com/agent.json"   # Or IPFS: ipfs://Qm...

forge script script/RegisterAgentSepolia.s.sol:RegisterAgentSepolia \
  --rpc-url "$RPC_URL" \
  --broadcast -vvvv
```

Use a public JSON URL (or IPFS) for `AGENT_URI` that returns agent metadata (e.g. name, description, image). The registry mints an identity NFT to `msg.sender`.

**Option B — Frontend**

Register the same wallet via [8004agents.ai](https://8004agents.ai) (or another ERC-8004 dapp) on Sepolia, then continue to Step 3.

**Verify:** The agent address should hold at least one NFT from the registry. You can check on [Sepolia Etherscan](https://sepolia.etherscan.io/) or the 8004agents.ai profile for that address.

---

## Step 3: Get launch params (prepare-launch API)

Get `LaunchParams` from your app’s prepare-launch endpoint. The API uses the **agent address** to read ERC-8004 metadata (name/symbol), mines a salt for the LBP hook, and returns `launchParams` ready for `AgenticoLauncher.launch()`.

**Start the app (if local):**

```bash
# From repo root
npm run dev
# API: http://localhost:3000/api/prepare-launch
```

**Call the API and save the response:**

```bash
# Replace with your agent wallet address and launcher address
export AGENT_ADDRESS=0x...   # Same wallet as in Step 2
export AGENTICO_LAUNCHER=0x867038c4b23A7f26c67C4c368d4ab60ba97e598b

# Local app
curl -X POST http://localhost:3000/api/prepare-launch \
  -H "Content-Type: application/json" \
  -d "{
    \"agentAddress\": \"$AGENT_ADDRESS\",
    \"chainId\": 11155111,
    \"agenticoLauncherAddress\": \"$AGENTICO_LAUNCHER\"
  }" > launch-params.json
```

Or with a deployed app:

```bash
curl -X POST https://your-app.vercel.app/api/prepare-launch \
  -H "Content-Type: application/json" \
  -d "{
    \"agentAddress\": \"$AGENT_ADDRESS\",
    \"chainId\": 11155111,
    \"agenticoLauncherAddress\": \"$AGENTICO_LAUNCHER\"
  }" > launch-params.json
```

**Check the response:**

```bash
# Should contain launchParams (name, symbol, salt, auctionParams, etc.)
cat launch-params.json | head -c 500
```

**Why `saltMined: false`?** Salt mining runs only when the app has `FEE_SPLITTER_FACTORY` set (and optionally `SALT_MINER_URL` for a remote miner). Without it, the API uses a random salt and the launch may revert with `HookAddressNotValid`. To get mined salt:

1. Set `FEE_SPLITTER_FACTORY` in `.env` (or when starting the app) to your deployed AgenticoFeeSplitterFactory address (from the same deployment as AgenticoLauncher). Example: `FEE_SPLITTER_FACTORY=0x5b8b09f6c97f5d78e6da64286e44ea5e1d72e06f`
2. Restart the app (`npm run dev`), then call prepare-launch again. The response will include `saltMined: true` and `saltMinedFor` when mining succeeds. If mining fails (e.g. no SALT_MINER_URL and local forge/miner not available), the response includes `saltMinedReason` with the cause.

If the API returns an error (e.g. "No ERC-8004 identity found"), ensure Step 2 completed and the same `agentAddress` is used. Do not edit `launch-params.json`; use it as-is in Step 4.

---

## Step 4: Launch token from the agent wallet

Call `AgenticoLauncher.launch(launchParams)` from the **same** agent wallet using the JSON from Step 3.

```bash
cd contracts

export PRIVATE_KEY=0x...   # Same agent wallet as Step 2 and Step 3
export RPC_URL=https://rpc.sepolia.org
export AGENTICO_LAUNCHER=0x867038c4b23A7f26c67C4c368d4ab60ba97e598b
export LAUNCH_PARAMS_JSON=./launch-params.json   # Path to the file (can be absolute)

forge script script/LaunchFromParamsSepolia.s.sol:LaunchFromParamsSepolia \
  --rpc-url "$RPC_URL" \
  --broadcast -vvvv
```

**Requirements:**

- `PRIVATE_KEY` must be the same wallet that:
  - Is registered on ERC-8004 (Step 2), and
  - Was used as `agentAddress` in prepare-launch (Step 3).
- `launch-params.json` must be the unmodified response from the prepare-launch API (root object with `launchParams`).

**On success:** The script broadcasts the `launch(params)` tx. The launcher deploys the UERC20 token and LBP strategy; the agent wallet is the vesting beneficiary. You can verify the new token and pool on Sepolia Etherscan and your app.

---

## Script usage (`scripts/test-flow.sh`)

From the repo root:

```bash
# Create a new wallet (prints private key + address; fund the address, then set PRIVATE_KEY and re-run)
./scripts/test-flow.sh --step 0

# Check balance (requires PRIVATE_KEY)
./scripts/test-flow.sh --step 1

# Register on ERC-8004 (requires PRIVATE_KEY, AGENT_URI)
./scripts/test-flow.sh --step 2

# Get launch params (requires PRIVATE_KEY; app must be running at APP_URL, default localhost:3000)
./scripts/test-flow.sh --step 3

# Launch token (requires PRIVATE_KEY and launch-params.json from step 3)
./scripts/test-flow.sh --step 4

# Run steps 1–4 in sequence (wallet must be funded)
./scripts/test-flow.sh
# or
./scripts/test-flow.sh --step all
```

Env (defaults): `RPC_URL`, `AGENTICO_LAUNCHER`, `APP_URL` (prepare-launch API base), `AGENT_URI` (for step 2). Optional: create `.env` in repo root; the script sources it.

---

## Quick reference

Same wallet everywhere:

```bash
# 1) Create/fund wallet, then:
export PRIVATE_KEY=0x...
export AGENT_ADDRESS=$(cast wallet address --private-key "$PRIVATE_KEY")
export RPC_URL=https://rpc.sepolia.org
export AGENTICO_LAUNCHER=0x867038c4b23A7f26c67C4c368d4ab60ba97e598b

# 2) Register on ERC-8004 (contracts/)
export AGENT_URI="https://example.com/agent.json"
forge script script/RegisterAgentSepolia.s.sol:RegisterAgentSepolia --rpc-url "$RPC_URL" --broadcast -vvvv

# 3) Get launch params (repo root; app must be running for local API)
curl -X POST http://localhost:3000/api/prepare-launch \
  -H "Content-Type: application/json" \
  -d "{\"agentAddress\": \"$AGENT_ADDRESS\", \"chainId\": 11155111, \"agenticoLauncherAddress\": \"$AGENTICO_LAUNCHER\"}" \
  > launch-params.json

# 4) Launch (contracts/; path to JSON)
export LAUNCH_PARAMS_JSON=./launch-params.json
forge script script/LaunchFromParamsSepolia.s.sol:LaunchFromParamsSepolia --rpc-url "$RPC_URL" --broadcast -vvvv
```

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| "No ERC-8004 identity found" | Same address used in prepare-launch as the one registered in Step 2; registration tx succeeded. |
| "Salt was mined for a different token" | Do not mix launch params from one prepare-launch response with a different name/symbol; call prepare-launch once and use that JSON for launch. |
| `vm.readFile: path not allowed` | Run the launch script from `contracts/` and set `LAUNCH_PARAMS_JSON` to a path under the project (e.g. `./launch-params.json`). See [DEPLOYMENT.md](./DEPLOYMENT.md) for `foundry.toml` `fs_permissions`. |
| HookAddressNotValid / createToken revert | Salt and launch params must match; use the prepare-launch API in one shot and do not edit the JSON. |
| **Empty revert at createToken** | **Token for this agent already exists.** Same agent (e.g. Agent 196) can only launch once; the token address is deterministic. Use a different agent (register another wallet on ERC-8004) and run steps 2–4 again. |
| Insufficient funds | Fund the agent wallet with more Sepolia ETH from a faucet. |

For deployment and salt mining details, see [DEPLOYMENT.md](./DEPLOYMENT.md).
