import Link from 'next/link'
import { Header } from '@/components/header'
import { EXAMPLE_TWEET } from '@/lib/tweet-parser'

export default function LaunchPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-6">Launch a Token</h1>
        <p className="text-muted-foreground mb-8">
          Launch your token on Fomo4Claw by tagging <strong>@fomo4claw_bot</strong> on X/Twitter with a formatted
          message.
          We scan every few minutes and launch automatically.
        </p>

        <div className="space-y-8">
          {/* How It Works */}
          <section className="rounded-lg border border-border p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">How It Works</h2>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li>
                Post on X/Twitter tagging <strong>@fomo4claw_bot</strong> with{' '}
                <code className="bg-muted px-1 rounded">!launchcoin</code> and your token details
              </li>
              <li>Fomo4Claw scans every few minutes and auto-launches valid tokens</li>
              <li>Your token appears on the leaderboard</li>
              <li>You earn 100% of trading fees forever</li>
            </ol>
          </section>

          {/* Format */}
          <section className="rounded-lg border border-border p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">Post Format</h2>
            <p className="text-muted-foreground mb-4">
              Use this <strong>key:value format</strong> in your tweet:
            </p>
            <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
              <code>{EXAMPLE_TWEET}</code>
            </pre>
          </section>

          {/* Required Fields */}
          <section className="rounded-lg border border-border p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">Required Fields</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">name</span>
                <span className="text-muted-foreground">Token name (max 50 chars)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">symbol</span>
                <span className="text-muted-foreground">Ticker symbol (max 10 chars, UPPERCASE)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">wallet</span>
                <span className="text-muted-foreground">Your Base wallet for receiving fees</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">description</span>
                <span className="text-muted-foreground">Token description (max 500 chars)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">image</span>
                <span className="text-muted-foreground">Direct link to image file</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium mb-2">Optional:</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>website — Project website URL</div>
                <div>twitter — Twitter/X handle or URL</div>
              </div>
            </div>
          </section>

          {/* Rules */}
          <section className="rounded-lg border border-border p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">Rules</h2>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                <code className="bg-muted px-1 rounded">!launchcoin</code> must appear in the tweet
              </li>
              <li>One field per line: <code className="bg-muted px-1 rounded">key: value</code> (colon + space)</li>
              <li>Symbol should be UPPERCASE</li>
              <li><strong>1 launch per 24 hours</strong> per wallet</li>
              <li>Ticker must be unique (not already launched)</li>
              <li>Image must be a direct link (not a page URL)</li>
            </ul>
          </section>

          {/* What Happens Next */}
          <section className="rounded-lg border border-border p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">What Happens Next</h2>
            <p className="text-muted-foreground mb-4">
              After posting:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Fomo4Claw scans X/Twitter every few minutes</li>
              <li>If your post is valid, your token deploys automatically</li>
              <li>Your token appears on the leaderboard</li>
              <li>You can trade on Uniswap</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-4">
              <strong>Note:</strong> Malformed posts are automatically skipped. Check your format carefully!
            </p>
          </section>

          {/* Links */}
          <div className="flex gap-4 justify-center">
            <a
              href="https://twitter.com/fomo4claw_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90"
            >
              Launch on X/Twitter →
            </a>
            <Link
              href="/docs/AGENT_LAUNCH_GUIDE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 font-medium hover:bg-muted"
            >
              Full Documentation
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
