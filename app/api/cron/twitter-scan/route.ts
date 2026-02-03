/**
 * Twitter Scanner Worker (Cron Job)
 * Scans X/Twitter for mentions containing !launchcoin and processes launches
 * 
 * Configure as Vercel Cron: vercel.json
 * {
 *   "crons": [{
 *     "path": "/api/cron/twitter-scan",
 *     "schedule": "*/5 * * * *"  // Every 5 minutes
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchLaunchMentions, replyToTweet } from '@/lib/twitter'
import { parseLaunchTweet } from '@/lib/tweet-parser'
import { prepareLaunchParams } from '@/lib/prepare-launch-helper'
import db from '@/lib/db'
import { createWalletClient, createPublicClient, http } from 'viem'
import { baseSepolia, sepolia, mainnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import type { LaunchParams } from '@/lib/liquidity-launcher'
import { FOMO4CLAW_LAUNCHER } from '@/lib/liquidity-launcher'

// Rate limit: 1 launch per 24 hours per wallet
const RATE_LIMIT_HOURS = 24

function getRpcUrl(chainId: number): string | undefined {
  if (chainId === 1) return process.env.MAINNET_RPC_URL
  if (chainId === 84532) return process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org'
  if (chainId === 11155111) return process.env.SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org'
  return undefined
}

/**
 * Execute on-chain launch
 */
async function executeLaunch(
  launchParams: LaunchParams,
  chainId: number
): Promise<{ txHash: string; tokenAddress: string }> {
  const privateKey = process.env.LAUNCHER_PRIVATE_KEY as `0x${string}`
  if (!privateKey) {
    throw new Error('LAUNCHER_PRIVATE_KEY not configured')
  }

  const chain = chainId === 1 ? mainnet : chainId === 84532 ? baseSepolia : sepolia
  const rpcUrl = getRpcUrl(chainId)
  const transport = http(rpcUrl)
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({ chain, transport })
  const walletClient = createWalletClient({ account, chain, transport })

  const launcher = FOMO4CLAW_LAUNCHER || process.env.FOMO4CLAW_LAUNCHER || process.env.AGENTICO_LAUNCHER
  if (!launcher) {
    throw new Error('FOMO4CLAW_LAUNCHER not configured')
  }

  // TODO: Import Fomo4ClawLauncher ABI
  // For now, this is a placeholder - you'll need to add the actual contract ABI
  const ABI = [
    {
      inputs: [
        {
          components: [
            { name: 'name', type: 'string' },
            { name: 'symbol', type: 'string' },
            { name: 'tokenMetadata', type: 'bytes' },
            { name: 'vestingBeneficiary', type: 'address' },
            { name: 'vestingStart', type: 'uint64' },
            { name: 'auctionParams', type: 'bytes' },
            { name: 'salt', type: 'bytes32' },
            { name: 'migrationBlock', type: 'uint64' },
            { name: 'sweepBlock', type: 'uint64' },
            { name: 'currency', type: 'address' },
            { name: 'airdropUnlockBlock', type: 'uint64' },
          ],
          name: 'params',
          type: 'tuple',
        },
      ],
      name: 'launch',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ] as const

  // Encode tokenMetadata (UERC20Metadata)
  // TODO: Implement proper encoding based on your UERC20Metadata structure
  const tokenMetadataBytes = '0x' // Placeholder

  const txHash = await walletClient.writeContract({
    address: launcher as `0x${string}`,
    abi: ABI,
    functionName: 'launch',
    args: [
      {
        name: launchParams.name,
        symbol: launchParams.symbol,
        tokenMetadata: tokenMetadataBytes as `0x${string}`,
        vestingBeneficiary: launchParams.vestingBeneficiary,
        vestingStart: BigInt(launchParams.vestingStart),
        auctionParams: launchParams.auctionParams,
        salt: launchParams.salt as `0x${string}`,
        migrationBlock: BigInt(launchParams.migrationBlock),
        sweepBlock: BigInt(launchParams.sweepBlock),
        currency: launchParams.currency,
        airdropUnlockBlock: BigInt(launchParams.airdropUnlockBlock),
      },
    ],
  })

  // Wait for transaction receipt to get token address
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  // TODO: Extract token address from receipt logs
  // For now, return placeholder
  const tokenAddress = '0x0000000000000000000000000000000000000000' // Placeholder

  return { txHash, tokenAddress }
}

/**
 * Check rate limit: 1 launch per 24h per wallet
 */
async function checkRateLimit(wallet: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000)
  const recentLaunches = await db.getLaunchesByWallet(wallet, since)
  return recentLaunches.length === 0
}

export async function GET(request: NextRequest) {
  // Verify cron secret (if using Vercel Cron)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get last processed tweet ID
    const lastProcessedId = await db.getLastProcessedTweetId()

    // Fetch new mentions
    const mentions = await fetchLaunchMentions(lastProcessedId, 100)

    const results = {
      processed: 0,
      launched: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    }

    for (const mention of mentions) {
      // Skip if already processed
      if (await db.isTweetProcessed(mention.id)) {
        results.skipped++
        continue
      }

      // Mark as processed immediately to avoid duplicates
      await db.markTweetProcessed(mention.id)

      try {
        // Parse tweet
        const parseResult = parseLaunchTweet(mention.text)

        if (!parseResult.success || !parseResult.data) {
          results.skipped++
          console.log(`Tweet ${mention.id}: Parse failed - ${parseResult.errors?.join(', ')}`)
          continue
        }

        const tokenDetails = parseResult.data

        // Check rate limit
        if (!(await checkRateLimit(tokenDetails.wallet))) {
          results.skipped++
          await replyToTweet(
            mention.id,
            `Rate limit: 1 launch per ${RATE_LIMIT_HOURS} hours per wallet. Please wait.`
          )
          continue
        }

        // Check symbol uniqueness (optional - can be done on-chain)
        // For now, skip if symbol already exists in recent launches
        const existingLaunches = await db.getAllLaunches()
        if (existingLaunches.some((l) => l.symbol.toUpperCase() === tokenDetails.symbol.toUpperCase())) {
          results.skipped++
          await replyToTweet(mention.id, `Symbol ${tokenDetails.symbol} already launched. Choose a different symbol.`)
          continue
        }

        // Create launch record
        const launchRecord = {
          tweetId: mention.id,
          tweetUrl: mention.url,
          authorHandle: mention.authorUsername,
          authorId: mention.authorId,
          tokenAddress: null,
          symbol: tokenDetails.symbol,
          name: tokenDetails.name,
          wallet: tokenDetails.wallet,
          launchedAt: null,
          txHash: null,
          status: 'processing' as const,
          createdAt: mention.createdAt,
        }

        await db.saveLaunch(launchRecord)

        // Prepare launch params
        const prepareResult = await prepareLaunchParams({
          tokenDetails,
          chainId: 84532, // Base Sepolia default
        })

        // Execute on-chain launch
        const { txHash, tokenAddress } = await executeLaunch(prepareResult.launchParams, prepareResult.chainId)

        // Update launch record
        launchRecord.tokenAddress = tokenAddress
        launchRecord.txHash = txHash
        launchRecord.launchedAt = new Date()
        launchRecord.status = 'launched'
        await db.saveLaunch(launchRecord)

        // Reply to tweet with success
        await replyToTweet(
          mention.id,
          `✅ Launch successful!\n\nToken: ${tokenDetails.name} (${tokenDetails.symbol})\nAddress: ${tokenAddress}\nTx: https://basescan.org/tx/${txHash}`
        )

        results.launched++
        results.processed++
      } catch (error) {
        results.failed++
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(`Tweet ${mention.id}: ${errorMsg}`)

        // Update launch record with error
        const existingRecord = await db.getLaunch(mention.id)
        if (existingRecord) {
          existingRecord.status = 'failed'
          existingRecord.error = errorMsg
          await db.saveLaunch(existingRecord)
        }

        // Optionally reply with error (be careful not to spam)
        // await replyToTweet(mention.id, `❌ Launch failed: ${errorMsg}`)

        console.error(`Error processing tweet ${mention.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      mentionsFound: mentions.length,
      ...results,
    })
  } catch (error) {
    console.error('Twitter scan error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
