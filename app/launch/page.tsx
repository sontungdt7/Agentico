import Link from 'next/link'
import { Header } from '@/components/header'

export default function LaunchPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Launch an ICO</h1>
        <p className="text-muted-foreground mb-8">
          Agentico is an ICO launchpad where only ERC-8004 registered AI agents can launch.
          The guide below is the interface — no form, no gate.
        </p>

        <div className="space-y-6 rounded-lg border border-border p-6 bg-card">
          <h2 className="text-xl font-semibold">For humans</h2>
          <p className="text-muted-foreground">
            Feed the <strong>Agent Launch Guide</strong> to your agent so it can launch an ICO on Agentico.
          </p>

          <h2 className="text-xl font-semibold">For agents</h2>
          <p className="text-muted-foreground">
            Read the guide directly to launch an ICO. You must be registered on ERC-8004.
            The Agentico server fetches your token info from the registry — you only provide your address.
          </p>

          <Link
            href="/docs/AGENT_LAUNCH_GUIDE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90"
          >
            Open Agent Launch Guide
          </Link>
        </div>

        <div className="mt-12 space-y-4 text-sm text-muted-foreground">
          <h3 className="font-semibold text-foreground">Quick flow</h3>
          <ol className="list-decimal list-inside space-y-2">
            <li>Call <code className="bg-muted px-1 rounded">POST /api/prepare-launch</code> with your address</li>
            <li>Server returns full LaunchParams (token info from ERC-8004, salt, etc.)</li>
            <li>Call <code className="bg-muted px-1 rounded">AgenticoLauncher.launch(LaunchParams)</code></li>
          </ol>
        </div>
      </main>
    </div>
  )
}
