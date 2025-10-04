import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function FinalCTA() {
  return (
    <section className="py-24">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 rounded-3xl border border-blue-500/30 bg-gradient-to-r from-blue-600/90 via-purple-600/80 to-blue-500/90 p-12 text-center text-white shadow-2xl">
        <h2 className="text-3xl font-bold sm:text-4xl">Ready to automate your trading desk?</h2>
        <p className="max-w-2xl text-lg text-white/80">
          Tradebot gives you production-grade infrastructure, secure webhook ingestion, and actionable telemetry in one platform. Launch your first bot in minutes.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="h-14 px-10 text-base font-semibold text-blue-600 shadow-xl"
          >
            <Link href="/auth">Create your account</Link>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-14 border-white/40 bg-transparent px-10 text-base font-semibold text-white hover:bg-white/10"
            asChild
          >
            <Link href="mailto:hello@tradebot.app">Talk to us</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
