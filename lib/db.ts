/**
 * Database client for storing launch records and processed tweets
 * Uses Supabase (PostgreSQL) or can be replaced with other providers
 */

export interface LaunchRecord {
  tweetId: string
  tweetUrl: string
  authorHandle: string
  authorId: string
  tokenAddress: string | null
  symbol: string
  name: string
  wallet: string
  launchedAt: Date | null
  txHash: string | null
  status: 'pending' | 'processing' | 'launched' | 'failed'
  error?: string
  createdAt: Date
}

// Simple in-memory store for development (replace with real DB)
class InMemoryDB {
  private launches: Map<string, LaunchRecord> = new Map()
  private processedTweets: Set<string> = new Set()

  async saveLaunch(record: LaunchRecord): Promise<void> {
    this.launches.set(record.tweetId, record)
  }

  async getLaunch(tweetId: string): Promise<LaunchRecord | null> {
    return this.launches.get(tweetId) || null
  }

  async getLaunchesByWallet(wallet: string, since?: Date): Promise<LaunchRecord[]> {
    const records = Array.from(this.launches.values())
    return records.filter((r) => {
      if (r.wallet.toLowerCase() !== wallet.toLowerCase()) return false
      if (since && r.createdAt < since) return false
      return true
    })
  }

  async getAllLaunches(): Promise<LaunchRecord[]> {
    return Array.from(this.launches.values())
  }

  async markTweetProcessed(tweetId: string): Promise<void> {
    this.processedTweets.add(tweetId)
  }

  async isTweetProcessed(tweetId: string): Promise<boolean> {
    return this.processedTweets.has(tweetId)
  }

  async getLastProcessedTweetId(): Promise<string | null> {
    // Return the most recent tweet ID from launches
    const records = Array.from(this.launches.values())
    if (records.length === 0) return null
    return records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].tweetId
  }
}

// Export singleton instance
const db = new InMemoryDB()

export default db

/**
 * Supabase implementation (uncomment and configure when ready)
 */
/*
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

export async function saveLaunch(record: LaunchRecord): Promise<void> {
  await supabase.from('launches').upsert({
    tweet_id: record.tweetId,
    tweet_url: record.tweetUrl,
    author_handle: record.authorHandle,
    author_id: record.authorId,
    token_address: record.tokenAddress,
    symbol: record.symbol,
    name: record.name,
    wallet: record.wallet,
    launched_at: record.launchedAt?.toISOString(),
    tx_hash: record.txHash,
    status: record.status,
    error: record.error,
    created_at: record.createdAt.toISOString(),
  })
}

export async function getLaunch(tweetId: string): Promise<LaunchRecord | null> {
  const { data } = await supabase
    .from('launches')
    .select('*')
    .eq('tweet_id', tweetId)
    .single()

  if (!data) return null

  return {
    tweetId: data.tweet_id,
    tweetUrl: data.tweet_url,
    authorHandle: data.author_handle,
    authorId: data.author_id,
    tokenAddress: data.token_address,
    symbol: data.symbol,
    name: data.name,
    wallet: data.wallet,
    launchedAt: data.launched_at ? new Date(data.launched_at) : null,
    txHash: data.tx_hash,
    status: data.status,
    error: data.error,
    createdAt: new Date(data.created_at),
  }
}

export async function isTweetProcessed(tweetId: string): Promise<boolean> {
  const { data } = await supabase
    .from('processed_tweets')
    .select('tweet_id')
    .eq('tweet_id', tweetId)
    .single()

  return !!data
}

export async function markTweetProcessed(tweetId: string): Promise<void> {
  await supabase.from('processed_tweets').insert({ tweet_id: tweetId })
}
*/
