import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-500/10 to-transparent blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-24 pt-32 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/90 shadow-lg backdrop-blur">
            Automated Trading Signals
          </span>
          <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl md:text-6xl">
            Launch, monitor, and scale every crypto trading bot from one control center.
          </h1>
          <p className="text-lg leading-relaxed text-white/80 sm:text-xl">
            Tradebot connects TradingView signals to real exchange accounts with secure webhooks, smart risk limits, and real-time monitoring. Spend less time wiring scripts—focus on the strategy.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" asChild className="h-14 px-10 text-base font-semibold shadow-xl">
            <Link href="/auth">Get Started Free</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild className="h-14 px-10 text-base font-semibold">
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </div>

        <dl className="mx-auto grid max-w-4xl grid-cols-1 gap-6 text-left sm:grid-cols-3">
          {[{
            label: 'Bots launched',
            value: '2,500+',
            description: 'Across live and demo portfolios'
          }, {
            label: 'Average setup time',
            value: '< 10 min',
            description: 'From signal idea to first trade'
          }, {
            label: 'Exchanges supported',
            value: 'Bitget & Hyperliquid',
            description: 'With more integrations on the roadmap'
          }].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80 shadow-lg backdrop-blur">
              <dt className="text-sm font-medium uppercase tracking-widest text-white/60">{item.label}</dt>
              <dd className="mt-2 text-2xl font-semibold text-white">{item.value}</dd>
              <p className="mt-1 text-sm text-white/70">{item.description}</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
