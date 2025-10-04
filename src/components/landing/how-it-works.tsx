const steps = [
  {
    title: 'Connect your exchange',
    description: 'Add Bitget or Hyperliquid API keys. Tradebot encrypts secrets and validates them before the first order.',
    number: '01',
  },
  {
    title: 'Create a bot + webhook',
    description: 'Define symbol, position sizing, and safety rules. Each bot gets a unique signing secret for incoming alerts.',
    number: '02',
  },
  {
    title: 'Send signals from TradingView',
    description: 'Use the generated JSON template in your alerts. Tradebot receives, authenticates, and routes the trade.',
    number: '03',
  },
  {
    title: 'Track performance in real time',
    description: 'Monitor fills, balances, and PnL from the dashboard or export data for deeper analysis.',
    number: '04',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-purple-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-300">
            How it works
          </span>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-gray-50 sm:text-4xl">
            From signal idea to automated execution in minutes.
          </h2>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
            No custom servers, queues, or cron jobs. Tradebot orchestrates the infrastructure so you can iterate faster.
          </p>
        </div>

        <ol className="mt-14 grid gap-6 sm:grid-cols-2">
          {steps.map((step) => (
            <li
              key={step.number}
              className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:border-purple-500/50 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900/80"
            >
              <span className="absolute right-6 top-6 text-4xl font-extrabold text-gray-100 dark:text-gray-800">
                {step.number}
              </span>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
