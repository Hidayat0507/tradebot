'use client'

import { Card } from "@/components/ui/card"
import { WebhookExample } from '@/components/bot/WebhookExample'

export default function ApiDocumentation({ botId, pair, orderSizePct }: { botId?: string; pair?: string; orderSizePct?: number }) {
  return (
    <Card className="p-6 mt-8 border border-gray-200 dark:border-gray-800">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100">Connect TradingView</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {botId ? 'Use these in your TradingView alert.' : 'After you create the bot, its ID and secret are filled in for you.'}
          </p>
        </div>
        <WebhookExample botId={botId} pair={pair} orderSizePct={orderSizePct} />
      </div>
    </Card>
  )
}
