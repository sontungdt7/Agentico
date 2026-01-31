import Link from 'next/link'
import { Header } from '@/components/header'

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12">
        <Link href="/auctions" className="text-muted-foreground hover:text-foreground text-sm mb-6 inline-block">
          ← Back to auctions
        </Link>
        <h1 className="text-3xl font-bold mb-6">Auction {id}</h1>
        <p className="text-muted-foreground">
          Auction detail, bid form, and claim UI. Implement with CCA contract integration.
        </p>
      </main>
    </div>
  )
}
