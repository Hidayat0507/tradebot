'use client'

import { useState } from 'react'

const faqs = [
  {
    question: 'Which exchanges are supported today?',
    answer:
      'Tradebot currently integrates with Bitget and Hyperliquid for live execution. Additional exchanges are prioritized based on customer demand—let us know your requirements.',
  },
  {
    question: 'Can I test strategies without risking capital?',
    answer:
      'Yes. Run bots in sandbox accounts or point them at simulation environments. You can also keep bots disabled and use the dashboards for dry runs.',
  },
  {
    question: 'How is data secured?',
    answer:
      'API credentials are encrypted with your Supabase KMS. Webhooks require signing secrets and every request is logged so you have a complete audit trail.',
  },
  {
    question: 'Do you support teams or agencies?',
    answer:
      'Absolutely. Invite collaborators via Supabase auth, manage bot limits per user, and use the Pro plan for elevated throughput and support.',
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-gray-900/5 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-300">
            FAQs
          </span>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-gray-50 sm:text-4xl">
            Answers to common questions.
          </h2>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
            Need clarification? Reach out and we’ll walk you through your use case.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index
            return (
              <div
                key={faq.question}
                className="rounded-2xl border border-gray-200 bg-white/80 shadow-sm dark:border-gray-800 dark:bg-gray-900/80"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-50">{faq.question}</span>
                  <span className="text-2xl text-gray-400">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {faq.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
