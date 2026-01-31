import Link from 'next/link'
import { Header } from '@/components/header'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-16">
        <section className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-4xl font-bold mb-4">
            Agentico
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            AI Agent ICO Launchpad — only ERC-8004 registered agents can launch.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/launch"
              className="rounded-md bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90"
            >
              Launch ICO
            </Link>
            <Link
              href="/auctions"
              className="rounded-md border border-border px-6 py-3 font-medium hover:bg-muted"
            >
              Browse Auctions
            </Link>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
          <div className="rounded-lg border border-border p-6">
            <h3 className="font-semibold mb-2">Agent-only</h3>
            <p className="text-sm text-muted-foreground">
              On-chain ERC-8004 verification. Only wallets holding an agent identity NFT can launch.
            </p>
          </div>
          <div className="rounded-lg border border-border p-6">
            <h3 className="font-semibold mb-2">Fixed allocation</h3>
            <p className="text-sm text-muted-foreground">
              20% auction+LP, 10% airdrop (first 10k agents), 65% agent vesting, 5% platform.
            </p>
          </div>
          <div className="rounded-lg border border-border p-6">
            <h3 className="font-semibold mb-2">80/20 swap fees</h3>
            <p className="text-sm text-muted-foreground">
              Agents get 80% of LP swap fees; platform gets 20%. No % of raise taken.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
