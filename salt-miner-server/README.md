# Agentico Salt Miner Server

Standalone HTTP server that mines Create2 salts for Agentico LBP launches. Deploy this separately (VPS, Railway, Fly.io) when your main app is on serverless (Vercel) and cannot run forge or the address-miner.

## Prerequisites

- Node.js 18+
- [Foundry](https://book.getfoundry.sh/) (`forge`)
- [Rust](https://rustup.rs/) (to build address-miner)

## Local setup

```bash
# From Agentico repo root
cd salt-miner-server
npm install

# Build address-miner (from repo root)
cd ../contracts/script/saltGenerator
cargo build --release
cd ../../..
```

## Run locally

```bash
# From Agentico repo root (so contracts/ is available)
cd salt-miner-server
npm run build
npm start
```

Or with tsx for dev:

```bash
npm run dev
```

Server listens on `PORT` (default 3040).

## API

### POST /mine

Mine a Create2 salt for FullRangeLBPStrategy deployment.

**Request body:**

```json
{
  "agentAddress": "0x...",
  "agenticoLauncher": "0x...",
  "feeSplitterFactory": "0x...",
  "chainId": 11155111,
  "tokenName": "Agent Token",
  "tokenSymbol": "AGNT",
  "currency": "0x0000000000000000000000000000000000000000",
  "currentBlock": 12345678,
  "feeSplitterFactoryNonce": 0
}
```

`currentBlock` and `feeSplitterFactoryNonce` are optional — the server fetches them from RPC if omitted.

**Response:**

```json
{
  "salt": "0x...",
  "currentBlock": 12345678,
  "feeSplitterFactoryNonce": 0
}
```

### GET /health

Health check. Returns `{ "ok": true }`.

## Env vars

| Var | Description |
|-----|-------------|
| `PORT` | Server port (default 3040) |
| `CONTRACTS_DIR` | Path to contracts (default: `../contracts`) |
| `MINER_PATH` | Path to address-miner binary |
| `RPC_URL` | Sepolia RPC (default: https://rpc.sepolia.org) |
| `SALT_MINER_API_KEY` | Optional; require `X-API-Key` header on `/mine` |
| `PRIVATE_KEY` | Optional; dummy used for forge view script |

## Main app integration

Set on your main app (e.g. Vercel):

- `SALT_MINER_URL` — Base URL of this server (e.g. `https://salt-miner.yourapp.railway.app`)
- `SALT_MINER_API_KEY` — If you set it on the server, set the same here
- `FEE_SPLITTER_FACTORY` — Still required (passed to the salt miner in the request)

## Docker

```bash
# Build from parent dir containing both Agentico and liquidity-launcher (sibling)
cd /path/to/parent  # has Agentico/ and liquidity-launcher/
docker build -f Agentico/salt-miner-server/Dockerfile -t agentico-salt-miner .

docker run -p 3040:3040 \
  -e SALT_MINER_API_KEY=your-secret \
  -e RPC_URL=https://rpc.sepolia.org \
  agentico-salt-miner
```

## Deploy (Railway, Fly.io, etc.)

1. Connect your repo.
2. Set root directory to repo root (or ensure `contracts/` and `salt-miner-server/` are present).
3. Build command: `cd salt-miner-server && npm ci && npm run build`
4. Start command: `node salt-miner-server/dist/index.js`
5. Ensure `forge` and the address-miner binary are available. For most PaaS this means using a custom Dockerfile (see above) or a buildpack that installs Foundry + Rust.

For Railway: use a [Dockerfile deployment](https://docs.railway.app/deploy/dockerfiles) with the provided Dockerfile.

## Deploy to Render.com

1. **Connect repo**: Go to [Render](https://render.com) → **New** → **Web Service** → connect your Agentico GitHub repo.

2. **Configure**:
   - **Name**: `agentico-salt-miner` (or any name)
   - **Region**: Choose closest to your users
   - **Root Directory**: leave blank (repo root)
   - **Environment**: **Docker**
   - **Dockerfile Path**: `salt-miner-server/Dockerfile.render`
   - **Instance Type**: Free or paid (mining can take 30–90 seconds; free tier may timeout)

3. **Environment variables** (in Render dashboard → Environment):
   | Key | Value |
   |-----|-------|
   | `SALT_MINER_API_KEY` | Optional; set a secret to protect `/mine` |
   | `RPC_URL` | `https://rpc.sepolia.org` (or your Sepolia RPC) |

4. **Advanced** (optional):
   - **Health Check Path**: `/health`
   - Render uses `PORT` automatically — no need to set it

5. **Deploy**: Click **Create Web Service**. Render builds from the Dockerfile and runs the server. Note the URL (e.g. `https://agentico-salt-miner.onrender.com`).

6. **Wire main app**: On Vercel, set `SALT_MINER_URL=https://your-service.onrender.com` (no trailing slash).

**Note**: Render free tier spins down after ~15 min of inactivity. The first request after spin-down can take 50+ seconds. For production, use a paid instance to avoid cold starts.
