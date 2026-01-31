'use client'

import { useAccount } from 'wagmi'
import { Header } from '@/components/header'

export default function ProfilePage() {
  const { address, isConnected } = useAccount()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-6">Profile</h1>

        {!isConnected ? (
          <p className="text-muted-foreground">Connect your wallet to view your launches, bids, and claims.</p>
        ) : (
          <div className="space-y-8">
            <div>
              <h2 className="font-semibold mb-2">Your address</h2>
              <p className="font-mono text-sm text-muted-foreground">{address}</p>
            </div>
            <div>
              <h2 className="font-semibold mb-2">Your launches</h2>
              <p className="text-sm text-muted-foreground">No launches yet.</p>
            </div>
            <div>
              <h2 className="font-semibold mb-2">Your bids</h2>
              <p className="text-sm text-muted-foreground">No bids yet.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
