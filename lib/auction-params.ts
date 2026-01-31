/**
 * Auction parameters encoding for liquidity-launcher FullRangeLBPStrategy
 * Matches AuctionParameters struct from @uniswap/continuous-clearing-auction
 */

import { encodeAbiParameters, encodePacked } from 'viem'

// FixedPoint96.Q96 = 2^96
const Q96 = 2n ** 96n

// ConstantsLib.MPS = 1e7 (milli-bips for auction steps)
const MPS = 10_000_000

// 1 week in blocks (~12 sec/block on Ethereum)
export const AUCTION_DURATION_BLOCKS_1_WEEK = 50_400

// Native ETH for CCA (address(0) = raise in ETH)
export const NATIVE_ETH = '0x0000000000000000000000000000000000000000' as const

// Starting market cap 33 ETH: floorPrice = (33 * Q96) / 1e9 for 1B supply
const FLOOR_PRICE_33_ETH_MCAP = (33n * Q96) / (10n ** 9n)

/** Auction step: (mps, blockDelta). Sum of mps*blockDelta must equal MPS. Sum of blockDelta = duration. */
function packAuctionSteps(steps: { mps: number; blockDelta: number }[]): `0x${string}` {
  // abi.encodePacked of (uint24 mps, uint40 blockDelta) for each step
  const hexParts: string[] = []
  for (const { mps, blockDelta } of steps) {
    const packed = encodePacked(['uint24', 'uint40'], [mps, blockDelta])
    hexParts.push(packed.slice(2)) // strip 0x for concatenation
  }
  return (`0x${hexParts.join('')}` || '0x') as `0x${string}`
}

/** Auction steps: sum(mps*blockDelta)=1e7, sum(blockDelta)=durationBlocks */
function defaultAuctionSteps(durationBlocks: number): `0x${string}` {
  const step1Blocks = Math.max(1, Math.floor(durationBlocks / 3))
  const step2Blocks = durationBlocks - step1Blocks
  const mps1 = Math.floor(MPS / 2 / step1Blocks)
  const mps2 = Math.floor((MPS - mps1 * step1Blocks) / step2Blocks)
  return packAuctionSteps([
    { mps: mps1, blockDelta: step1Blocks },
    { mps: mps2, blockDelta: step2Blocks },
  ])
}

/** AuctionParameters ABI types for encodeAbiParameters */
const AUCTION_PARAMS_ABI = [
  { name: 'currency', type: 'address' },
  { name: 'tokensRecipient', type: 'address' },
  { name: 'fundsRecipient', type: 'address' },
  { name: 'startBlock', type: 'uint64' },
  { name: 'endBlock', type: 'uint64' },
  { name: 'claimBlock', type: 'uint64' },
  { name: 'tickSpacing', type: 'uint256' },
  { name: 'validationHook', type: 'address' },
  { name: 'floorPrice', type: 'uint256' },
  { name: 'requiredCurrencyRaised', type: 'uint128' },
  { name: 'auctionStepsData', type: 'bytes' },
] as const

export interface EncodeAuctionParamsOptions {
  currency: `0x${string}`
  agentAddress: `0x${string}`
  agenticoLauncher: `0x${string}`
  startBlock: number
  durationBlocks?: number
  floorPrice?: bigint
  tickSpacing?: bigint
}

/**
 * Encode AuctionParameters for FullRangeLBPStrategy configData
 * Defaults: 1 week duration, 33 ETH starting market cap, native ETH currency
 */
export function encodeAuctionParams({
  currency,
  agentAddress,
  agenticoLauncher,
  startBlock,
  durationBlocks = AUCTION_DURATION_BLOCKS_1_WEEK,
  floorPrice = FLOOR_PRICE_33_ETH_MCAP,
  tickSpacing = 100n * Q96,
}: EncodeAuctionParamsOptions): `0x${string}` {
  const endBlock = startBlock + durationBlocks
  const claimBlock = endBlock + 10

  const auctionStepsData = defaultAuctionSteps(durationBlocks)

  return encodeAbiParameters(AUCTION_PARAMS_ABI, [
    currency,
    agenticoLauncher, // tokensRecipient: unsold tokens to launcher
    agentAddress, // fundsRecipient: raised currency to agent
    BigInt(startBlock),
    BigInt(endBlock),
    BigInt(claimBlock),
    tickSpacing,
    '0x0000000000000000000000000000000000000000' as `0x${string}`, // validationHook
    floorPrice,
    0n, // requiredCurrencyRaised
    auctionStepsData,
  ])
}
