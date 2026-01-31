import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, parseAbi } from 'viem'
import { sepolia, mainnet } from 'viem/chains'
import type { LaunchParams, UERC20Metadata } from '@/lib/liquidity-launcher'
import { SEPOLIA, MAINNET } from '@/lib/liquidity-launcher'

const ERC8004_REGISTRY = '0x7177a6867296406881E20d6647232314736Dd09A' as const

const ERC721_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
])

function deriveSymbol(name: string): string {
  // Take first 4-5 chars, uppercase, alphanumeric only
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase()
  return cleaned || 'AGNT'
}

async function fetchTokenMetadata(agentAddress: `0x${string}`, chainId: number): Promise<{
  name: string
  description: string
  image: string
  symbol: string
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
  if (!res.ok) return null

  const json = (await res.json()) as { name?: string; description?: string; image?: string }
  const name = json.name ?? 'Agent'
  const description = json.description ?? ''
  const image = json.image ?? ''

  return {
    name,
    description,
    image,
    symbol: deriveSymbol(name),
  }
}

// Generate a salt. For production LBP, run mine_salt script; this is a placeholder.
function generateSalt(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`
}

// Build default auction params (simplified - full encoding would match liquidity-launcher)
// For now return empty bytes; agent/contract will need proper encoding
function buildDefaultAuctionParams(agentAddress: `0x${string}`): `0x${string}` {
  // Placeholder: real implementation encodes MigratorParameters + AuctionParameters
  // per liquidity-launcher FullRangeLBPStrategyFactory configData format
  return '0x' as `0x${string}`
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

    const salt = generateSalt()
    const vestingStart = Math.floor(Date.now() / 1000)
    const currency =
      (body.currency as `0x${string}`) ??
      (chainId === 1 ? MAINNET.weth : SEPOLIA.weth)

    const chain = chainId === 1 ? mainnet : sepolia
    const transport = http(chainId === 1 ? undefined : 'https://rpc.sepolia.org')
    const client = createPublicClient({ chain, transport })
    const currentBlock = await client.getBlockNumber()
    const migrationBlock = Number(currentBlock) + 500
    const sweepBlock = Number(currentBlock) + 1000
    const airdropUnlockBlock = Number(currentBlock) + 350 // after auction (~300 blocks)

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
      auctionParams: buildDefaultAuctionParams(agentAddress),
      salt,
      migrationBlock,
      sweepBlock,
      currency,
      airdropUnlockBlock,
    }

    return NextResponse.json({
      launchParams,
      chainId,
      note: 'Salt is randomly generated. For production LBP on Ethereum Sepolia, run the mine_salt script from liquidity-launcher to get a valid Create2 salt.',
    })
  } catch (err) {
    console.error('prepare-launch error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
