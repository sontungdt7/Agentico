import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, parseAbi } from 'viem'
import { sepolia, mainnet } from 'viem/chains'
import type { LaunchParams, UERC20Metadata } from '@/lib/liquidity-launcher'
import { SEPOLIA, MAINNET, AGENTICO_LAUNCHER } from '@/lib/liquidity-launcher'
import { encodeAuctionParams, AUCTION_DURATION_BLOCKS_1_WEEK } from '@/lib/auction-params'
import { mineSalt } from '@/lib/salt-mining'

const ERC8004_REGISTRY = '0x7177a6867296406881E20d6647232314736Dd09A' as const

const ERC721_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
])

async function fetchTokenMetadata(agentAddress: `0x${string}`, chainId: number): Promise<{
  name: string
  symbol: string
  description: string
  image: string
} | null> {
  const chain = chainId === 1 ? mainnet : sepolia
  const transport = http(chainId === 1 ? undefined : 'https://rpc.sepolia.org')
  const client = createPublicClient({
    chain,
    transport,
  })

  const balance = await client.readContract({
    address: ERC8004_REGISTRY,
    abi: ERC721_ABI,
    functionName: 'balanceOf',
    args: [agentAddress],
  })

  if (balance === BigInt(0)) return null

  const tokenId = await client.readContract({
    address: ERC8004_REGISTRY,
    abi: ERC721_ABI,
    functionName: 'tokenOfOwnerByIndex',
    args: [agentAddress, BigInt(0)],
  })

  const tokenIdNum = Number(tokenId)
  // Use agent ID for token name/symbol to ensure uniqueness (no duplicate tokens)
  const name = `Agent ${tokenIdNum}`
  const symbol = `AGNT${tokenIdNum}`

  const tokenUri = await client.readContract({
    address: ERC8004_REGISTRY,
    abi: ERC721_ABI,
    functionName: 'tokenURI',
    args: [tokenId],
  })

  const url = tokenUri.startsWith('ipfs://')
    ? `https://ipfs.io/ipfs/${tokenUri.slice(7)}`
    : tokenUri

  const res = await fetch(url)
  if (!res.ok) {
    return { name, symbol, description: '', image: '' }
  }

  const json = (await res.json()) as { description?: string; image?: string }
  return {
    name,
    symbol,
    description: json.description ?? '',
    image: json.image ?? '',
  }
}

// Fallback when salt mining unavailable (serverless, missing forge/miner)
function generateRandomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`
}

// Build encoded AuctionParameters for FullRangeLBPStrategy configData
function buildAuctionParams(
  agentAddress: `0x${string}`,
  agenticoLauncher: `0x${string}`,
  currency: `0x${string}`,
  startBlock: number,
  durationBlocks: number = 300
): `0x${string}` {
  return encodeAuctionParams({
    currency,
    agentAddress,
    agenticoLauncher,
    startBlock,
    durationBlocks,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const agentAddress = body.agentAddress as `0x${string}` | undefined
    const chainId = body.chainId ?? 11155111 // Ethereum Sepolia default

    if (!agentAddress || !/^0x[a-fA-F0-9]{40}$/.test(agentAddress)) {
      return NextResponse.json(
        { error: 'Invalid agentAddress: must be a valid Ethereum address' },
        { status: 400 }
      )
    }

    const metadata = await fetchTokenMetadata(agentAddress, chainId)
    if (!metadata) {
      return NextResponse.json(
        { error: 'No ERC-8004 identity found for this address' },
        { status: 404 }
      )
    }

    const agenticoLauncher =
      (body.agenticoLauncherAddress as `0x${string}`) ?? AGENTICO_LAUNCHER
    if (!agenticoLauncher) {
      return NextResponse.json(
        {
          error:
            'agenticoLauncherAddress required. Pass it in the request body or set AGENTICO_LAUNCHER env.',
        },
        { status: 400 }
      )
    }

    const feeSplitterFactory = (process.env.FEE_SPLITTER_FACTORY as `0x${string}`) ?? body.feeSplitterFactory
    const vestingStart = Math.floor(Date.now() / 1000)
    const currency =
      (body.currency as `0x${string}`) ??
      (chainId === 1 ? MAINNET.nativeEth : SEPOLIA.nativeEth)

    const chain = chainId === 1 ? mainnet : sepolia
    const transport = http(chainId === 1 ? undefined : 'https://rpc.sepolia.org')
    const client = createPublicClient({ chain, transport })
    const currentBlock = await client.getBlockNumber()
    const currentBlockNum = Number(currentBlock)
    const migrationBlock = currentBlockNum + 500
    const sweepBlock = currentBlockNum + 1000
    const auctionDurationBlocks =
      body.auctionParams?.durationBlocks ?? AUCTION_DURATION_BLOCKS_1_WEEK
    const airdropUnlockBlock = currentBlockNum + auctionDurationBlocks + 50 // after auction ends

    // Try salt mining; fall back to random if forge/miner unavailable (e.g. serverless)
    let salt: `0x${string}`
    let saltMined = false
    if (feeSplitterFactory && chainId === 11155111) {
      try {
        salt = await mineSalt({
          agentAddress,
          agenticoLauncher,
          feeSplitterFactory,
          chainId,
          tokenName: metadata.name,
          tokenSymbol: metadata.symbol,
          currency,
          currentBlock: currentBlockNum,
        })
        saltMined = true
      } catch (err) {
        console.warn('Salt mining failed, using random salt:', err)
        salt = generateRandomSalt()
      }
    } else {
      salt = generateRandomSalt()
      if (!feeSplitterFactory && chainId === 11155111) {
        console.warn('FEE_SPLITTER_FACTORY not set; using random salt')
      }
    }

    const auctionParams = buildAuctionParams(
      agentAddress,
      agenticoLauncher,
      currency,
      currentBlockNum,
      auctionDurationBlocks
    )

    const tokenMetadata: UERC20Metadata = {
      description: metadata.description,
      website: 'https://agentico.xyz',
      image: metadata.image,
    }

    const launchParams: LaunchParams = {
      name: metadata.name,
      symbol: metadata.symbol,
      tokenMetadata,
      vestingBeneficiary: agentAddress,
      vestingStart,
      auctionParams,
      salt,
      migrationBlock,
      sweepBlock,
      currency,
      airdropUnlockBlock,
    }

    return NextResponse.json({
      launchParams,
      chainId,
      agenticoLauncherAddress: agenticoLauncher,
      saltMined,
      note: saltMined
        ? 'Salt was mined for valid Uniswap v4 hook address.'
        : 'Salt is random (mining unavailable). For production LBP on Sepolia, set FEE_SPLITTER_FACTORY env, ensure forge + address-miner are installed, or run mine_salt_sepolia.sh. See docs/DEPLOYMENT.md.',
    })
  } catch (err) {
    console.error('prepare-launch error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
