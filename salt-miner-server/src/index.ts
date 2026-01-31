/**
 * Standalone salt-mining server for Agentico LBP launches.
 * Deploy to a VPS/Railway/Fly.io where forge and address-miner are available.
 *
 * POST /mine — Mine a Create2 salt for FullRangeLBPStrategy
 * Health: GET /health
 */

import express from 'express'
import { spawn } from 'child_process'
import path from 'path'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const HOOK_MASK = '0x0000000000000000000000000000000000002000'
const LIQUIDITY_LAUNCHER = '0x00000008412db3394C91A5CbD01635c6d140637C'
const FULL_RANGE_LBP_FACTORY = '0x89Dd5691e53Ea95d19ED2AbdEdCf4cBbE50da1ff'

// Contracts dir: repo root / contracts (when run from salt-miner-server/)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const CONTRACTS_DIR = process.env.CONTRACTS_DIR ?? path.join(REPO_ROOT, 'contracts')
const MINER_PATH =
  process.env.MINER_PATH ??
  path.join(CONTRACTS_DIR, 'script', 'saltGenerator', 'target', 'release', 'address-miner')

const app = express()
app.use(express.json({ limit: '1kb' }))

const API_KEY = process.env.SALT_MINER_API_KEY

function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!API_KEY) return next()
  const key = req.headers['x-api-key'] ?? req.query.apiKey
  if (key !== API_KEY) {
    res.status(401).json({ error: 'Invalid or missing API key' })
    return
  }
  next()
}

function exec(
  cmd: string,
  args: string[],
  options: { cwd: string; env: Record<string, string | undefined>; timeout?: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (d) => (stdout += d.toString()))
    proc.stderr?.on('data', (d) => (stderr += d.toString()))
    const timeout = options.timeout ?? 120_000
    const t = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`Timed out after ${timeout / 1000}s`))
    }, timeout)
    proc.on('close', (code) => {
      clearTimeout(t)
      if (code === 0) resolve(stdout + stderr)
      else reject(new Error(`Process exited ${code}: ${(stderr || stdout).slice(0, 500)}`))
    })
    proc.on('error', reject)
  })
}

interface MineRequest {
  agentAddress: string
  agenticoLauncher: string
  feeSplitterFactory: string
  chainId?: number
  tokenName?: string
  tokenSymbol?: string
  currency?: string
  currentBlock?: number
  feeSplitterFactoryNonce?: number
  /** Override UERC20_FACTORY for target network (e.g. when testing different chains) */
  uerc20Factory?: string
  /** Override LIQUIDITY_LAUNCHER for target network */
  liquidityLauncher?: string
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'agentico-salt-miner' })
})

app.post('/mine', authMiddleware, async (req, res) => {
  try {
    const body = req.body as MineRequest
    const agentAddress = body.agentAddress
    const agenticoLauncher = body.agenticoLauncher
    const feeSplitterFactory = body.feeSplitterFactory
    const chainId = body.chainId ?? 11155111
    const tokenName = body.tokenName ?? 'Agent Token'
    const tokenSymbol = body.tokenSymbol ?? 'AGNT'

    if (!agentAddress || !/^0x[a-fA-F0-9]{40}$/.test(agentAddress)) {
      res.status(400).json({ error: 'Invalid agentAddress' })
      return
    }
    if (!agenticoLauncher || !/^0x[a-fA-F0-9]{40}$/.test(agenticoLauncher)) {
      res.status(400).json({ error: 'Invalid agenticoLauncher' })
      return
    }
    if (!feeSplitterFactory || !/^0x[a-fA-F0-9]{40}$/.test(feeSplitterFactory)) {
      res.status(400).json({ error: 'Invalid feeSplitterFactory' })
      return
    }

    // Support Base Sepolia (84532) and Ethereum Sepolia (11155111)
    if (chainId !== 84532 && chainId !== 11155111) {
      res.status(400).json({ error: 'Only Base Sepolia (84532) or Ethereum Sepolia (11155111) is supported' })
      return
    }

    // RPC: use env or default by chainId (liquidity-launcher is deployed on Base Sepolia)
    const rpcUrl =
      process.env.RPC_URL ??
      (chainId === 84532 ? 'https://sepolia.base.org' : 'https://rpc.sepolia.org')

    let currentBlock = body.currentBlock
    let feeSplitterNonce = body.feeSplitterFactoryNonce
    if (currentBlock === undefined || feeSplitterNonce === undefined) {
      const client = createPublicClient({
        chain: sepolia,
        transport: http(rpcUrl),
      })
      if (currentBlock === undefined) {
        currentBlock = Number(await client.getBlockNumber())
      }
      if (feeSplitterNonce === undefined) {
        feeSplitterNonce = Number(
          await client.getTransactionCount({
            address: feeSplitterFactory as `0x${string}`,
          })
        )
      }
    }

    const env: Record<string, string> = {
      ...process.env,
      PRIVATE_KEY:
        process.env.PRIVATE_KEY ??
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      AGENT_ADDRESS: agentAddress,
      AGENTICO_LAUNCHER: agenticoLauncher,
      FEE_SPLITTER_FACTORY: feeSplitterFactory,
      FEE_SPLITTER_FACTORY_NONCE: String(feeSplitterNonce),
      CURRENT_BLOCK: String(currentBlock),
      TOKEN_NAME: tokenName,
      TOKEN_SYMBOL: tokenSymbol,
      RPC_URL: rpcUrl,
    }
    if (body.currency) env.CURRENCY = body.currency
    // Contract addresses: request body overrides env; unset = use script defaults (Base Sepolia)
    const uerc20Factory = body.uerc20Factory ?? process.env.UERC20_FACTORY
    const liquidityLauncher = body.liquidityLauncher ?? process.env.LIQUIDITY_LAUNCHER
    if (uerc20Factory && /^0x[a-fA-F0-9]{40}$/.test(uerc20Factory)) env.UERC20_FACTORY = uerc20Factory
    if (liquidityLauncher && /^0x[a-fA-F0-9]{40}$/.test(liquidityLauncher)) env.LIQUIDITY_LAUNCHER = liquidityLauncher

    // 1. Run GetInitCodeHashSepolia
    const forgeOut = await exec(
      'forge',
      [
        'script',
        'script/GetInitCodeHashSepolia.s.sol:GetInitCodeHashSepolia',
        '--rpc-url',
        rpcUrl,
        '-vvv',
      ],
      { cwd: CONTRACTS_DIR, env, timeout: 30_000 }
    )

    const initHashMatch = forgeOut.match(/SEPOLIA_INIT_CODE_HASH=(0x[a-fA-F0-9]{64})/)
    const initCodeHash = initHashMatch?.[1]
    if (!initCodeHash) {
      throw new Error('Could not parse init code hash from forge output')
    }

    // 2. Run address-miner
    const minerOut = await exec(
      MINER_PATH,
      [
        initCodeHash,
        HOOK_MASK,
        '-m',
        agenticoLauncher,
        '-s',
        FULL_RANGE_LBP_FACTORY,
        '-l',
        LIQUIDITY_LAUNCHER,
        '-q',
      ],
      { cwd: CONTRACTS_DIR, env, timeout: 90_000 }
    )

    const saltMatch = minerOut.trim().match(/^(0x[a-fA-F0-9]{64})$/)
    const salt = saltMatch?.[1]
    if (!salt) {
      throw new Error(`Could not parse salt from miner: ${minerOut.slice(0, 100)}`)
    }

    res.json({
      salt,
      currentBlock,
      feeSplitterFactoryNonce: feeSplitterNonce,
    })
  } catch (err) {
    console.error('mine error:', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Salt mining failed',
    })
  }
})

const PORT = parseInt(process.env.PORT ?? '3040', 10)
app.listen(PORT, () => {
  console.log(`Salt miner server listening on port ${PORT}`)
  console.log(`Contracts dir: ${CONTRACTS_DIR}`)
  console.log(`Miner path: ${MINER_PATH}`)
})
