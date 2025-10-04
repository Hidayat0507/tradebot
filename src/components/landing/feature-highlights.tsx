const featureItems = [
  {
    title: 'Seamless TradingView Webhooks',
    description:
      'Drop-in webhook endpoints validate secrets, sanitize payloads, and translate strategy alerts into exchange-native orders instantly.',
    icon: '💡',
  },
  {
    title: 'Exchange Credentials Locked Down',
    description:
      'API keys are encrypted at rest and never leave your Supabase project. Disable bots or rotate secrets with one click.',
    icon: '🔐',
  },
  {
    title: 'Risk Controls That Stick',
    description:
      'Max position sizing, stop-loss templates, and circuit breakers keep automation in bounds—even when strategies misfire.',
    icon: '🛡️',
  },
  {
    title: 'Real-Time Telemetry',
    description:
      'Dashboards aggregate trade fills, exchange balances, and signal metadata so you can audit and iterate faster.',
    icon: '📊',
  },
]

export function FeatureHighlights() {
  return (
    <section id="features" className="bg-gray-50/40 py-20 dark:bg-gray-900/40">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_2fr] lg:px-8">
        <div className="max-w-xl">
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Why teams choose Tradebot
          </span>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-4xl">
            Production-ready automation without building a backend from scratch.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-gray-600 dark:text-gray-300">
            Connect multiple strategies, exchanges, and accounts. Tradebot ships with the infrastructure glue so you can focus on signals and execution—no more brittle scripts or unmanaged servers.
          </p>
        </div>

        <div className="grid gap-6">
          {featureItems.map((feature) => (
            <div
              key={feature.title}
              className="group flex gap-5 rounded-2xl border border-gray-200/80 bg-white/80 p-6 shadow-sm transition hover:border-blue-500/60 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900/80"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-2xl">
                {feature.icon}
              </span>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 transition group-hover:text-blue-600 dark:text-gray-50 dark:group-hover:text-blue-300">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
