export interface LaunchRequest {
  name: string
  symbol: string
  wallet: `0x${string}`
  description: string
  image: string
  website?: string
  twitter?: string
}

export interface ParseResult {
  success: boolean
  data?: LaunchRequest
  errors?: string[]
}

/**
 * Parse launch request from tweet text
 * Supports Clawnch-style key:value format
 */
export function parseLaunchTweet(tweetText: string): ParseResult {
  // Check for !launchcoin trigger (case-insensitive)
  if (!tweetText.toLowerCase().includes('!launchcoin')) {
    return {
      success: false,
      errors: ['Tweet does not contain !launchcoin trigger'],
    }
  }

  const lines = tweetText.split('\n')
  const fields: Record<string, string> = {}

  // Parse key:value pairs
  for (const line of lines) {
    // Match "key: value" format (colon + space)
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (match) {
      const key = match[1].toLowerCase().trim()
      const value = match[2].trim()
      if (key && value) {
        fields[key] = value
      }
    }
  }

  // Validate required fields
  const errors: string[] = []
  const required = ['name', 'symbol', 'wallet', 'description', 'image']

  for (const field of required) {
    if (!fields[field]) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    }
  }

  // Validate wallet address format
  const walletRegex = /^0x[a-fA-F0-9]{40}$/
  if (!walletRegex.test(fields.wallet)) {
    errors.push('Invalid wallet address format')
  }

  // Validate symbol (should be uppercase, max 10 chars)
  const symbol = fields.symbol.toUpperCase().trim()
  if (symbol.length > 10) {
    errors.push('Symbol must be 10 characters or less')
  }

  // Validate name (max 50 chars)
  if (fields.name.length > 50) {
    errors.push('Name must be 50 characters or less')
  }

  // Validate description (max 500 chars)
  if (fields.description.length > 500) {
    errors.push('Description must be 500 characters or less')
  }

  // Validate image URL (must be a direct link)
  const imageUrl = fields.image.trim()
  if (!isValidImageUrl(imageUrl)) {
    errors.push('Image must be a direct URL to an image file')
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    }
  }

  // Build launch request
  const request: LaunchRequest = {
    name: fields.name.trim(),
    symbol: symbol,
    wallet: fields.wallet.toLowerCase() as `0x${string}`,
    description: fields.description.trim(),
    image: imageUrl,
    website: fields.website?.trim(),
    twitter: fields.twitter?.trim(),
  }

  return {
    success: true,
    data: request,
  }
}

/**
 * Check if URL is a valid direct image link
 */
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname.toLowerCase()

    // Check for image file extensions
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
    const hasImageExtension = imageExtensions.some((ext) => pathname.endsWith(ext))

    // Check for known image hosting domains
    const imageHosts = [
      'iili.io',
      'i.imgur.com',
      'imgur.com',
      'arweave.net',
      'ipfs.io',
      'gateway.pinata.cloud',
      'cloudflare-ipfs.com',
    ]
    const isImageHost = imageHosts.some((host) => parsed.hostname.includes(host))

    // IPFS protocol
    if (url.startsWith('ipfs://')) return true

    return hasImageExtension || isImageHost
  } catch {
    return false
  }
}

/**
 * Format example for documentation
 */
export const EXAMPLE_TWEET = `@fomo4claw_bot !launchcoin
name: Molty Coin
symbol: MOLTY
wallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12
description: The official Molty token
image: https://iili.io/xxxxx.jpg
website: https://molty.xyz
twitter: @MoltyCoin`
