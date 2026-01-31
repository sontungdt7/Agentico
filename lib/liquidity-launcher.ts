/**
 * Agentico / Liquidity Launcher contract addresses and LaunchParams encoding
 * Chains: Ethereum Sepolia (test), Ethereum mainnet (prod)
 */

// ERC-8004 Identity Registry — deterministic across chains
export const ERC8004_IDENTITY_REGISTRY = '0x7177a6867296406881E20d6647232314736Dd09A' as const

// Ethereum Sepolia (chainId 11155111)
export const SEPOLIA = {
  chainId: 11155111,
  liquidityLauncher: '0x00000008412db3394C91A5CbD01635c6d140637C' as const,
  fullRangeLBPStrategyFactory: '0x89Dd5691e53Ea95d19ED2AbdEdCf4cBbE50da1ff' as const,
  // UERC20Factory, CCA Factory: source from liquidity-launcher for Sepolia
  uerc20Factory: '0xD97d0c9FB20CF472D4d52bD8e0468A6C010ba448' as const, // may need update for Ethereum Sepolia
  ccaFactory: '0xcca1101C61cF5cb44C968947985300DF945C3565' as const, // may need update
  // Sepolia WETH
  weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as const,
} as const

// Ethereum Mainnet
export const MAINNET = {
  chainId: 1,
  liquidityLauncher: '0x00000008412db3394C91A5CbD01635c6d140637C' as const,
  fullRangeLBPStrategyFactory: '0x65aF3B62EE79763c704f04238080fBADD005B332' as const,
  weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as const,
} as const

// Fixed token params
export const DECIMALS = 18
export const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n // 1 billion

// Allocation percentages
export const ALLOCATION = {
  auctionLp: 20, // 20%
  airdrop: 10, // 10%
  vesting: 70, // 70% total (65% agent + 5% platform)
} as const

// Vesting duration: 5 years in seconds
export const VESTING_DURATION_SECONDS = 5 * 365 * 24 * 60 * 60

export interface UERC20Metadata {
  description: string
  website: string
  image: string
}

export interface LaunchParams {
  name: string
  symbol: string
  tokenMetadata: UERC20Metadata
  vestingBeneficiary: `0x${string}`
  vestingStart: number
  auctionParams: `0x${string}` // encoded AuctionParameters
  salt: `0x${string}`
  /** LBP migrator: block when migration can begin (e.g. auction end + offset) */
  migrationBlock: number
  /** LBP migrator: block when operator can sweep */
  sweepBlock: number
  /** Auction / LBP currency (e.g. WETH) */
  currency: `0x${string}`
  /** Block when airdrop claims can begin (e.g. auction endBlock) */
  airdropUnlockBlock: number
}

export interface PrepareLaunchRequest {
  agentAddress: `0x${string}`
  chainId?: number
  auctionParams?: {
    durationBlocks?: number
    floorPrice?: string
    currency?: `0x${string}`
  }
}

export interface PrepareLaunchResponse {
  launchParams: LaunchParams
  chainId: number
  agenticoLauncherAddress?: `0x${string}` // when deployed
}
