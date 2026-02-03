/**
 * Helper function to build LaunchParams from token details
 * Used by both the API endpoint and Twitter worker
 */

import { createPublicClient, http } from 'viem'
import { sepolia, mainnet, baseSepolia } from 'viem/chains'
import type { LaunchParams, UERC20Metadata } from '@/lib/liquidity-launcher'
import { SEPOLIA, MAINNET, BASE_SEPOLIA, FOMO4CLAW_LAUNCHER } from '@/lib/liquidity-launcher'
import { encodeAuctionParams, AUCTION_DURATION_BLOCKS_1_WEEK } from '@/lib/auction-params'
import { mineSalt } from '@/lib/salt-mining'
import type { LaunchRequest } from '@/lib/tweet-parser'

const RPC_TIMEOUT_MS = 25_000

function getRpcUrl(chainId: number): string | undefined {
  if (chainId === 1) return process.env.MAINNET_RPC_URL
  if (chainId === 84532) return process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org'
  if (chainId === 11155111) return process.env.SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org'
  return undefined
}

function generateRandomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`
}

export interface PrepareLaunchOptions {
  tokenDetails: LaunchRequest
  chainId?: number
  fomo4clawLauncher?: `0x${string}`
  /** @deprecated Use fomo4clawLauncher */
  agenticoLauncher?: `0x${string}`
  feeSplitterFactory?: `0x${string}`
  uerc20Factory?: `0x${string}`
  liquidityLauncher?: `0x${string}`
  currency?: `0x${string}`
  auctionDurationBlocks?: number
}

export interface PrepareLaunchResult {
  launchParams: LaunchParams
  chainId: number
  fomo4clawLauncherAddress: `0x${string}`
  /** @deprecated Use fomo4clawLauncherAddress */
  agenticoLauncherAddress?: `0x${string}`
  saltMined: boolean
  saltMinedReason?: string
  saltMinedFor?: { name: string; symbol: string }
}

export async function prepareLaunchParams(
  options: PrepareLaunchOptions
): Promise<PrepareLaunchResult> {
  const {
    tokenDetails,
    chainId = 84532, // Base Sepolia default
    fomo4clawLauncher,
    agenticoLauncher, // backward compat
    feeSplitterFactory = process.env.FEE_SPLITTER_FACTORY as `0x${string}` | undefined,
    uerc20Factory,
    liquidityLauncher = process.env.LIQUIDITY_LAUNCHER as `0x${string}` | undefined,
    currency,
    auctionDurationBlocks = AUCTION_DURATION_BLOCKS_1_WEEK,
  } = options

  const launcher = fomo4clawLauncher || agenticoLauncher || FOMO4CLAW_LAUNCHER

  if (!launcher) {
    throw new Error('fomo4clawLauncherAddress required. Set FOMO4CLAW_LAUNCHER env or pass in options.')
  }

  const vestingStart = Math.floor(Date.now() / 1000)
  const defaultCurrency =
    currency ??
    (chainId === 1
      ? MAINNET.nativeEth
      : chainId === 84532
        ? BASE_SEPOLIA.nativeEth
        : SEPOLIA.nativeEth)

  const chain = chainId === 1 ? mainnet : chainId === 84532 ? baseSepolia : sepolia
  const rpcUrl = getRpcUrl(chainId)
  const transport = http(rpcUrl, { timeout: RPC_TIMEOUT_MS })
  const client = createPublicClient({ chain, transport })
  const currentBlock = await client.getBlockNumber()
  const currentBlockNum = Number(currentBlock)
  const migrationBlock = currentBlockNum + 500
  const sweepBlock = currentBlockNum + 1000
  const airdropUnlockBlock = currentBlockNum + auctionDurationBlocks + 50 // after auction ends

  // Try salt mining; fall back to random if forge/miner unavailable
  let salt: `0x${string}`
  let saltMined = false
  let saltMinedReason: string | undefined
  let saltMinedFor: { name: string; symbol: string } | undefined

  if (feeSplitterFactory && (chainId === 84532 || chainId === 11155111)) {
    const defaultUerc20Factory =
      chainId === 11155111
        ? SEPOLIA.uerc20Factory
        : chainId === 84532
          ? BASE_SEPOLIA.uerc20Factory
          : undefined
    const finalUerc20Factory =
      uerc20Factory ?? (process.env.UERC20_FACTORY as `0x${string}` | undefined) ?? defaultUerc20Factory

    try {
      const mined = await mineSalt({
        agentAddress: tokenDetails.wallet,
        agenticoLauncher: launcher, // mineSalt still uses old param name
        feeSplitterFactory,
        chainId,
        tokenName: tokenDetails.name,
        tokenSymbol: tokenDetails.symbol,
        currency: defaultCurrency,
        currentBlock: currentBlockNum,
        uerc20Factory: finalUerc20Factory,
        liquidityLauncher,
      })
      salt = mined.salt
      saltMined = true
      if (mined.tokenName !== undefined && mined.tokenSymbol !== undefined) {
        if (mined.tokenName !== tokenDetails.name || mined.tokenSymbol !== tokenDetails.symbol) {
          throw new Error(
            `Salt was mined for different token. Miner: "${mined.tokenName}" "${mined.tokenSymbol}"; Request: "${tokenDetails.name}" "${tokenDetails.symbol}"`
          )
        }
        saltMinedFor = { name: tokenDetails.name, symbol: tokenDetails.symbol }
      }
    } catch (err) {
      console.warn('Salt mining failed, using random salt:', err)
      salt = generateRandomSalt()
      saltMinedReason = err instanceof Error ? err.message : 'Salt mining failed'
    }
  } else {
    salt = generateRandomSalt()
    if (!feeSplitterFactory && (chainId === 84532 || chainId === 11155111)) {
      saltMinedReason =
        'FEE_SPLITTER_FACTORY not set. Set it (and optionally SALT_MINER_URL) in .env to enable salt mining.'
    }
  }

  const auctionParams = encodeAuctionParams({
    currency: defaultCurrency,
    agentAddress: tokenDetails.wallet,
    agenticoLauncher: launcher, // encodeAuctionParams still uses old param name
    startBlock: currentBlockNum,
    durationBlocks: auctionDurationBlocks,
  })

  const tokenMetadata: UERC20Metadata = {
    description: tokenDetails.description,
    website: tokenDetails.website || 'https://fomo4claw.xyz',
    image: tokenDetails.image,
  }

  const launchParams: LaunchParams = {
    name: tokenDetails.name,
    symbol: tokenDetails.symbol,
    tokenMetadata,
    vestingBeneficiary: tokenDetails.wallet,
    vestingStart,
    auctionParams,
    salt,
    migrationBlock,
    sweepBlock,
    currency: defaultCurrency,
    airdropUnlockBlock,
  }

  return {
    launchParams,
    chainId,
    fomo4clawLauncherAddress: launcher,
    agenticoLauncherAddress: launcher, // backward compat
    saltMined,
    saltMinedReason,
    saltMinedFor,
  }
}
