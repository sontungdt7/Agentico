import { TwitterApi } from 'twitter-api-v2'

// Initialize Twitter API client
export function getTwitterClient() {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN
  const apiKey = process.env.TWITTER_API_KEY
  const apiSecret = process.env.TWITTER_API_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET

  // Prefer Bearer Token (simpler, read-only)
  if (bearerToken) {
    return new TwitterApi(bearerToken)
  }

  // Fallback to OAuth 1.0a (if need write access for replies)
  if (apiKey && apiSecret && accessToken && accessTokenSecret) {
    return new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: accessToken,
      accessSecret: accessTokenSecret,
    })
  }

  throw new Error(
    'Twitter API credentials not configured. Set TWITTER_BEARER_TOKEN or OAuth credentials.'
  )
}

export interface TwitterMention {
  id: string
  text: string
  authorId: string
  authorUsername: string
  createdAt: Date
  url: string
}

/**
 * Fetch recent mentions of @fomo4claw_bot containing !launchcoin
 * @param sinceId Optional tweet ID to fetch only newer tweets
 * @param maxResults Max number of results (default 100)
 */
export async function fetchLaunchMentions(
  sinceId?: string,
  maxResults: number = 100
): Promise<TwitterMention[]> {
  const client = getTwitterClient()
  const handle =
    process.env.FOMO4CLAW_TWITTER_HANDLE ||
    process.env.AGENTICO_TWITTER_HANDLE || // backward compat
    'fomo4claw_bot'

  try {
    // Search for mentions containing !launchcoin
    // Note: Twitter API v2 search may require elevated access for full-archive search
    const searchQuery = `@${handle} !launchcoin -is:retweet`

    const tweets = await client.v2.search(searchQuery, {
      max_results: Math.min(maxResults, 100), // API limit is 100
      since_id: sinceId,
      'tweet.fields': ['created_at', 'author_id', 'text'],
      'user.fields': ['username'],
      expansions: ['author_id'],
    })

    // Map to our format
    const mentions: TwitterMention[] = []
    const users = tweets.data.includes?.users || []

    for (const tweet of tweets.data.data || []) {
      const author = users.find((u) => u.id === tweet.author_id)
      if (!author) continue

      mentions.push({
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.author_id!,
        authorUsername: author.username,
        createdAt: new Date(tweet.created_at!),
        url: `https://twitter.com/${author.username}/status/${tweet.id}`,
      })
    }

    return mentions
  } catch (error) {
    console.error('Error fetching Twitter mentions:', error)
    throw error
  }
}

/**
 * Get a specific tweet by ID
 */
export async function getTweetById(tweetId: string): Promise<TwitterMention | null> {
  const client = getTwitterClient()

  try {
    const tweet = await client.v2.singleTweet(tweetId, {
      'tweet.fields': ['created_at', 'author_id', 'text'],
      'user.fields': ['username'],
      expansions: ['author_id'],
    })

    if (!tweet.data) return null

    const users = tweet.data.includes?.users || []
    const author = users.find((u) => u.id === tweet.data?.author_id)

    if (!author) return null

    return {
      id: tweet.data.id,
      text: tweet.data.text,
      authorId: tweet.data.author_id!,
      authorUsername: author.username,
      createdAt: new Date(tweet.data.created_at!),
      url: `https://twitter.com/${author.username}/status/${tweet.data.id}`,
    }
  } catch (error) {
    console.error('Error fetching tweet:', error)
    return null
  }
}

/**
 * Reply to a tweet (requires OAuth 1.0a, not Bearer Token)
 */
export async function replyToTweet(
  tweetId: string,
  text: string
): Promise<{ id: string } | null> {
  const client = getTwitterClient()

  try {
    // Check if we have write access (OAuth 1.0a)
    if (!process.env.TWITTER_ACCESS_TOKEN) {
      console.warn('Cannot reply: OAuth credentials not configured')
      return null
    }

    const reply = await client.v2.reply(text, tweetId)
    return { id: reply.data.id }
  } catch (error) {
    console.error('Error replying to tweet:', error)
    return null
  }
}
