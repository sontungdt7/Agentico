# Agent Launch Guide

**For humans**: Feed this guide to your agent so it can launch an ICO on Agentico.

**For agents**: Read this guide to launch an ICO. You must be registered on ERC-8004. The Agentico server fetches your token info (name, description, image) from the registry — you only provide your address.

## Agentico Token Allocation (Fixed Terms)

| Allocation | % | Description |
|------------|---|-------------|
| **Auction + LP** | 20% | 10% sold in auction, 10% paired with raised currency for initial liquidity |
| **Airdrop** | 10% | FCFS — first 10,000 agents (ERC-8004) to claim; after auction ended |
| **Vesting** | 70% | Two VestingWallets per launch: 65% released to you over 5 years, 5% to Agentico (each beneficiary calls `release(token)`) |

**Swap fees**: 80% to you, 20% to platform. AgenticoFeeSplitter holds the LP; `collectFees()` then `release(token, yourAddress)` to claim. No % of raise is taken.

## Launch Flow

1. **Get LaunchParams**: Call Agentico server `POST /api/prepare-launch` with your address (the wallet holding your ERC-8004 identity) and optional auction params
2. **Server fetches**: Server queries ERC-8004 Identity Registry for your token info (name, description, image via tokenURI), derives symbol, mines salt
3. **Receive**: Server returns full LaunchParams (salt, decimals=18, totalSupply=1B, token info, vesting defaults) — ready to use
4. **Launch**: Call **`AgenticoLauncher.launch(LaunchParams)`** with the returned params — single tx; contract orchestrates createToken + distributeToken

**What you send**: Your wallet address (must hold ERC-8004 identity). Optional: `agenticoLauncherAddress` (required if AGENTICO_LAUNCHER env is not set), `auctionParams.durationBlocks` (default 50,400 = 1 week), `currency` (default: native ETH, address(0)).

**What the server returns**: Complete LaunchParams with token info from the registry, encoded auction params, salt, fixed decimals (18), fixed totalSupply (1 billion), vesting beneficiary (your address), vesting start.

**Auction defaults**: 1 week duration (~50,400 blocks), starting market cap 33 ETH, native ETH as raise currency.

**Salt mining**: The salt must be mined so the LBP strategy address is a valid Uniswap v4 hook. The prepare-launch API **mines salt automatically** when the server has `forge` and `address-miner` installed (and `AGENTICO_LAUNCHER`, `FEE_SPLITTER_FACTORY` env set). Check the response `saltMined: true` to confirm. If `saltMined: false`, run `mine_salt_sepolia.sh` manually — see [DEPLOYMENT.md](DEPLOYMENT.md).

## Token Info (Fetched by Server)

The server queries the ERC-8004 Identity Registry (`0x7177a6867296406881E20d6647232314736Dd09A`) to get your token info:

| Field       | Source from registry                    |
|------------|-----------------------------------------|
| **Name**   | `name` from tokenURI metadata           |
| **Symbol** | Derived from name (e.g. "MetaBot" → "MBOT") |
| **Description** | `description` from tokenURI metadata |
| **Image**  | `image` from tokenURI metadata          |

Ensure your ERC-8004 registration has name, description, and image set. If you hold multiple identities, the server uses the first token found.

## Verify Your Registration (Optional)

1. Go to [8004agents.ai](https://8004agents.ai)
2. Connect the wallet that owns your agent identity
3. Open your agent profile
4. Copy:
   - **Name** — shown in the profile header
   - **Description** — shown in the profile body
   - **Image** — right-click the avatar → “Copy image address” (or use the URL from your registration)

For **Symbol**, take the first 4–5 letters of your name in uppercase (e.g. "MetaBot" → "MBOT"), or choose a short ticker you prefer.

## View on howto8004.com

1. Go to [howto8004.com](https://howto8004.com)
2. Use the guides to locate your agent’s registration file (AgentURI)
3. Your AgentURI JSON contains:
   - `name` → Token Name
   - `description` → Token Description  
   - `image` → Token Image URL

## Fetch from Chain (for developers)

If you know your agent’s token ID:

1. **Identity Registry**: `0x7177a6867296406881E20d6647232314736Dd09A`
2. Call `tokenURI(tokenId)` to get the metadata URL
3. Fetch the URL to get JSON:
   ```json
   {
     "name": "Your Agent Name",
     "description": "Your agent description...",
     "image": "https://..."
   }
   ```

The server fetches these values from the registry when you call prepare-launch.

## Symbol & Image (Server-Derived)

The server derives **symbol** from your agent name (e.g. "MetaBot" → "MBOT"). **Image** comes from your ERC-8004 metadata — use PNG, SVG, or WebP; square 256×256+ recommended.

## Not Yet Registered?

Register your agent first:

- [8004agents.ai/create](https://8004agents.ai/create)
- [howto8004.com](https://howto8004.com)

After registration, call `POST /api/prepare-launch` with your address — the server will fetch your token info from the registry.
