'use client'

import Link from 'next/link'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function Header() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-semibold text-lg">
          Agentico
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/launch" className="text-muted-foreground hover:text-foreground">
            Launch
          </Link>
          <Link href="/auctions" className="text-muted-foreground hover:text-foreground">
            Auctions
          </Link>
          <Link href="/profile" className="text-muted-foreground hover:text-foreground">
            Profile
          </Link>
          {isConnected && address ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-mono">
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
              <button
                onClick={() => disconnect()}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Connect
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
