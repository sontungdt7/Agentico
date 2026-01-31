/**
 * Salt mining for Agentico LBP launches.
 * When SALT_MINER_URL is set: calls the remote salt-miner server.
 * When running self-hosted (no SALT_MINER_URL): spawns forge + address-miner locally.
 * Falls back to random salt if both unavailable (e.g. Vercel without salt-miner server).
 */

import { spawn } from 'child_process'
import path from 'path'
import { createPublicClient, http } from 'viem'
import { mainnet, sepolia } from 'viem/chains'

const HOOK_MASK = '0x0000000000000000000000000000000000002000'
const LIQUIDITY_LAUNCHER = '0x00000008412db3394C91A5CbD01635c6d140637C'
const FULL_RANGE_LBP_FACTORY = '0x89Dd5691e53Ea95d19ED2AbdEdCf4cBbE50da1ff'

export interface MineSaltParams {
  agentAddress: `0x${string}`
  agenticoLauncher: `0x${string}`
  feeSplitterFactory: `0x${string}`
  chainId: number
  tokenName: string
  tokenSymbol: string
  currency?: `0x${string}`
  currentBlock?: number
  feeSplitterFactoryNonce?: number
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
      reject(new Error(`Salt mining timed out after ${timeout / 1000}s`))
    }, timeout)
    proc.on('close', (code) => {
      clearTimeout(t)
      if (code === 0) resolve(stdout + stderr)
      else reject(new Error(`Process exited ${code}: ${stderr || stdout}`))
    })
    proc.on('error', (err) => {
      clearTimeout(t)
      reject(err)
    })
  })
}

/**
 * Mine a valid Create2 salt via remote salt-miner server or local forge+miner.
 * Returns the salt as 0x-prefixed hex bytes32, or throws.
 */
export async function mineSalt(params: MineSaltParams): Promise<`0x${string}`> {
  const saltMinerUrl = process.env.SALT_MINER_URL

  // Prefer remote salt-miner server (for Vercel / serverless)
  if (saltMinerUrl) {
    return mineSaltViaServer(saltMinerUrl, params)
  }

  // Fallback: local forge + address-miner (self-hosted only)
  const projectRoot = path.resolve(process.cwd())
  const contractsDir = path.join(projectRoot, 'contracts')
  const minerPath = path.join(
    contractsDir,
    'script',
    'saltGenerator',
    'target',
    'release',
    'address-miner'
  )

  const rpcUrl =
    params.chainId === 1
      ? process.env.RPC_URL ?? 'https://eth.llamarpc.com'
      : process.env.RPC_URL ?? 'https://rpc.sepolia.org'

  // Fetch current block and factory nonce if not provided
  let currentBlock = params.currentBlock
  let feeSplitterNonce = params.feeSplitterFactoryNonce
  if (currentBlock === undefined || feeSplitterNonce === undefined) {
    const client = createPublicClient({
      chain: params.chainId === 1 ? mainnet : sepolia,
      transport: http(rpcUrl),
    })
    if (currentBlock === undefined) {
      currentBlock = Number(await client.getBlockNumber())
    }
    if (feeSplitterNonce === undefined) {
      feeSplitterNonce = Number(
        await client.getTransactionCount({
          address: params.feeSplitterFactory,
        })
      )
    }
  }

  const env: Record<string, string> = {
    ...process.env,
    PRIVATE_KEY: process.env.PRIVATE_KEY ?? '0x0000000000000000000000000000000000000000000000000000000000000001',
    AGENT_ADDRESS: params.agentAddress,
    AGENTICO_LAUNCHER: params.agenticoLauncher,
    FEE_SPLITTER_FACTORY: params.feeSplitterFactory,
    FEE_SPLITTER_FACTORY_NONCE: String(feeSplitterNonce),
    CURRENT_BLOCK: String(currentBlock),
    TOKEN_NAME: params.tokenName,
    TOKEN_SYMBOL: params.tokenSymbol,
    RPC_URL: rpcUrl,
  }
  if (params.currency) env.CURRENCY = params.currency as string

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
    { cwd: contractsDir, env, timeout: 30_000 }
  )

  const initHashMatch = forgeOut.match(/SEPOLIA_INIT_CODE_HASH=(0x[a-fA-F0-9]{64})/)
  const initCodeHash = initHashMatch?.[1]
  if (!initCodeHash) {
    throw new Error(`Could not parse init code hash from forge output`)
  }

  // 2. Run address-miner
  const minerOut = await exec(
    minerPath,
    [initCodeHash, HOOK_MASK, '-m', params.agenticoLauncher, '-s', FULL_RANGE_LBP_FACTORY, '-l', LIQUIDITY_LAUNCHER, '-q'],
    { cwd: contractsDir, env, timeout: 90_000 }
  )

  const saltMatch = minerOut.trim().match(/^(0x[a-fA-F0-9]{64})$/)
  const salt = saltMatch?.[1]
  if (!salt) {
    throw new Error(`Could not parse salt from miner output: ${minerOut.slice(0, 100)}`)
  }

  return salt as `0x${string}`
}

/**
 * Call remote salt-miner server (e.g. deployed on Railway, Fly.io).
 */
async function mineSaltViaServer(
  baseUrl: string,
  params: MineSaltParams
): Promise<`0x${string}`> {
  const url = baseUrl.replace(/\/$/, '') + '/mine'
  const apiKey = process.env.SALT_MINER_API_KEY

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    },
    body: JSON.stringify({
      agentAddress: params.agentAddress,
      agenticoLauncher: params.agenticoLauncher,
      feeSplitterFactory: params.feeSplitterFactory,
      chainId: params.chainId,
      tokenName: params.tokenName,
      tokenSymbol: params.tokenSymbol,
      currency: params.currency,
      currentBlock: params.currentBlock,
      feeSplitterFactoryNonce: params.feeSplitterFactoryNonce,
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `Salt miner returned ${res.status}`)
  }

  const data = (await res.json()) as { salt?: string }
  const salt = data.salt
  if (!salt || !/^0x[a-fA-F0-9]{64}$/.test(salt)) {
    throw new Error('Invalid salt from salt-miner server')
  }
  return salt as `0x${string}`
}
