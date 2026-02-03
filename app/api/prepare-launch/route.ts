import { NextRequest, NextResponse } from 'next/server'
import { prepareLaunchParams } from '@/lib/prepare-launch-helper'
import type { LaunchRequest } from '@/lib/tweet-parser'

/**
 * Prepare-launch API endpoint
 * Accepts token details directly (name, symbol, wallet, description, image)
 * Used internally by Twitter worker; can also be called directly
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Accept either direct token details or legacy agentAddress format
    let tokenDetails: LaunchRequest

    if (body.name && body.symbol && body.wallet && body.description && body.image) {
      // New format: direct token details
      tokenDetails = {
        name: body.name,
        symbol: body.symbol,
        wallet: body.wallet.toLowerCase() as `0x${string}`,
        description: body.description,
        image: body.image,
        website: body.website,
        twitter: body.twitter,
      }
    } else if (body.agentAddress) {
      // Legacy format: return error (ERC-8004 no longer supported)
      return NextResponse.json(
        {
          error:
            'ERC-8004 lookup no longer supported. Please provide token details directly: name, symbol, wallet, description, image',
        },
        { status: 400 }
      )
    } else {
      return NextResponse.json(
        {
          error:
            'Missing required fields. Provide: name, symbol, wallet, description, image (optional: website, twitter)',
        },
        { status: 400 }
      )
    }

    // Validate wallet address
    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenDetails.wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 })
    }

    // Validate symbol length
    if (tokenDetails.symbol.length > 10) {
      return NextResponse.json({ error: 'Symbol must be 10 characters or less' }, { status: 400 })
    }

    // Validate name length
    if (tokenDetails.name.length > 50) {
      return NextResponse.json({ error: 'Name must be 50 characters or less' }, { status: 400 })
    }

    // Validate description length
    if (tokenDetails.description.length > 500) {
      return NextResponse.json({ error: 'Description must be 500 characters or less' }, { status: 400 })
    }

    const result = await prepareLaunchParams({
      tokenDetails,
      chainId: body.chainId,
      fomo4clawLauncher: body.fomo4clawLauncherAddress || body.agenticoLauncherAddress, // backward compat
      feeSplitterFactory: body.feeSplitterFactory,
      uerc20Factory: body.uerc20Factory,
      liquidityLauncher: body.liquidityLauncher,
      currency: body.currency,
      auctionDurationBlocks: body.auctionParams?.durationBlocks,
    })

    return NextResponse.json({
      launchParams: result.launchParams,
      chainId: result.chainId,
      fomo4clawLauncherAddress: result.fomo4clawLauncherAddress,
      agenticoLauncherAddress: result.agenticoLauncherAddress, // backward compat
      saltMined: result.saltMined,
      saltMinedReason: result.saltMinedReason,
      saltMinedFor: result.saltMinedFor,
      note: result.saltMined
        ? 'Salt was mined for valid Uniswap v4 hook address. saltMinedFor must match launchParams.name/symbol.'
        : 'Salt is random (mining unavailable). For production LBP, set FEE_SPLITTER_FACTORY env. See docs/DEPLOYMENT.md.',
    })
  } catch (err) {
    console.error('prepare-launch error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
