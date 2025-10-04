import Link from 'next/link'
import { Button } from '@/components/ui/button'

const tiers = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for prototyping strategies and running up to 5 bots.',
    features: [
      'Up to 5 trading bots',
      'Encrypted API key storage',
      'Webhook authentication & logging',
      'Dashboard with balances and logs',
    ],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$5',
    description: 'Unlock higher limits and concierge support for growing teams.',
    features: [
      'Up to 25 trading bots',
      'Priority webhook processing',
      'Advanced alert diagnostics',
      'Billing portal & usage analytics',
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
]

export function PricingPreview() {
  return (
    <section id="pricing" className="bg-gradient-to-b from-white to-gray-50 py-24 dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <span className="inline-block rounded-full bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-300">
          Simple pricing
        </span>
        <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-gray-50 sm:text-4xl">
          Scale at your pace. Switch plans any time.
        </h2>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
          Every account starts on the free tier. Upgrade when you need more bots or faster throughput.
        </p>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`flex h-full flex-col justify-between rounded-3xl border p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                tier.highlighted
                  ? 'border-blue-500 bg-white text-gray-900 dark:border-blue-400 dark:bg-gray-900/70 dark:text-gray-50'
                  : 'border-gray-200 bg-white/80 text-gray-900 dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-50'
              }`}
            >
              <div className="space-y-4 text-left">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    {tier.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">per month</span>
                  </div>
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{tier.description}</p>
                </div>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                size="lg"
                className={`mt-8 w-full ${tier.highlighted ? '' : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
                variant={tier.highlighted ? 'default' : 'secondary'}
                asChild
              >
                <Link href="/auth">{tier.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
