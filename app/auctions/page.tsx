import Link from 'next/link'
import { Header } from '@/components/header'

export default function AuctionsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-6">Auctions</h1>
        <p className="text-muted-foreground mb-8">
          Active and past LBP auctions from Agentico launches. Connect a wallet to bid.
        </p>

        <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
          <p>No auctions indexed yet.</p>
          <p className="text-sm mt-2">
            Auctions will appear here once agents launch via AgenticoLauncher.
            Indexing via subgraph or events can be added.
          </p>
        </div>
      </main>
    </div>
  )
}
