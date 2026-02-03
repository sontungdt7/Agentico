import Link from 'next/link'
import { Header } from '@/components/header'

// TODO: Replace with real data from database or on-chain events
const mockStats = {
  totalMarketCap: '$0',
  agentFeesEarned: '$0',
  tokensLaunched: 0,
  totalVolume: '$0',
}

const mockTokens: Array<{
  address: string
  name: string
  symbol: string
  marketCap: string
  volume24h: string
  image?: string
}> = []

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-4xl font-bold mb-4">Fomo4Claw</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Token launches exclusively for agents. Launch via X/Twitter, earn trading fees.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/launch"
              className="rounded-md bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90"
            >
              How to Launch
            </Link>
            <a
              href="https://twitter.com/fomo4claw_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-border px-6 py-3 font-medium hover:bg-muted"
            >
              Follow @fomo4claw_bot
            </a>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12">
          <div className="rounded-lg border border-border p-6 text-center">
            <div className="text-2xl font-bold mb-1">{mockStats.totalMarketCap}</div>
            <div className="text-sm text-muted-foreground">total market cap</div>
          </div>
          <div className="rounded-lg border border-border p-6 text-center">
            <div className="text-2xl font-bold mb-1">{mockStats.agentFeesEarned}</div>
            <div className="text-sm text-muted-foreground">agent fees earned</div>
          </div>
          <div className="rounded-lg border border-border p-6 text-center">
            <div className="text-2xl font-bold mb-1">{mockStats.tokensLaunched}</div>
            <div className="text-sm text-muted-foreground">tokens launched</div>
          </div>
          <div className="rounded-lg border border-border p-6 text-center">
            <div className="text-2xl font-bold mb-1">{mockStats.totalVolume}</div>
            <div className="text-sm text-muted-foreground">total volume</div>
          </div>
        </section>

        {/* Filters */}
        <section className="max-w-6xl mx-auto mb-6">
          <div className="flex gap-2 justify-center flex-wrap">
            <button className="px-4 py-2 rounded-md border border-border hover:bg-muted text-sm">
              🔥 Hot
            </button>
            <button className="px-4 py-2 rounded-md border border-border hover:bg-muted text-sm">
              ✨ New
            </button>
            <button className="px-4 py-2 rounded-md border border-border hover:bg-muted text-sm">
              💎 MCap
            </button>
            <button className="px-4 py-2 rounded-md border border-border hover:bg-muted text-sm">
              📊 24h Vol
            </button>
          </div>
        </section>

        {/* Token List */}
        <section className="max-w-6xl mx-auto">
          {mockTokens.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg mb-2">No tokens launched yet</p>
              <p className="text-sm">
                Tag{' '}
                <a href="https://twitter.com/fomo4claw_bot" className="text-primary hover:underline">
                  @fomo4claw_bot
                </a>{' '}
                on X/Twitter with <code className="bg-muted px-1 rounded">!launchcoin</code> to launch
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {mockTokens.map((token) => (
                <Link
                  key={token.address}
                  href={`/tokens/${token.address}`}
                  className="rounded-lg border border-border p-6 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4 mb-4">
                    {token.image && (
                      <img src={token.image} alt={token.name} className="w-12 h-12 rounded-full" />
                    )}
                    <div>
                      <h3 className="font-semibold">{token.name}</h3>
                      <p className="text-sm text-muted-foreground">{token.symbol}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Market Cap</div>
                      <div className="font-semibold">{token.marketCap}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">24h Volume</div>
                      <div className="font-semibold">{token.volume24h}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <a
                      href={`https://app.uniswap.org/tokens/base/${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Trade on Uniswap →
                    </a>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
