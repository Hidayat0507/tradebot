'use client'

import { Card } from "@/components/ui/card"
import { CopyButton } from "@/components/ui/copy-button"

export default function ApiDocumentation({ botId }: { botId?: string }) {
  const buyJson = {
    symbol: "BTCUSDT",
    action: "BUY",
    order_size: "100%",
    position_size: "1",
    timestamp: new Date().toISOString()
  }

  const sellJson = {
    symbol: "BTCUSDT",
    action: "SELL",
    order_size: "100%",
    position_size: "0",
    timestamp: new Date().toISOString()
  }

  const webhookUrl = botId 
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhook/${botId}`
    : 'https://your-site.com/api/webhook/<bot-id>'

  return (
    <Card className="p-6 mt-8 border border-gray-200 dark:border-gray-800">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">API Documentation</h3>
          <p className="text-gray-600 dark:text-gray-300">
            Triggering this Bot via API is easy.<br />
            Send a <span className="font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">POST</span> request with the Buy or Sell JSON to the Endpoint URL shown below.<br />
            Make sure to add your server&apos;s IP address to the bot&apos;s allow list (above), otherwise that signal &quot;shall not pass&quot; 😅
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Required Fields</h4>
          <div className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-md p-4">
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <li><code className="text-blue-600 dark:text-blue-400">symbol</code>: Trading pair (e.g., "BTCUSDT")</li>
              <li><code className="text-blue-600 dark:text-blue-400">action</code>: Must be "BUY" or "SELL"</li>
              <li><code className="text-blue-600 dark:text-blue-400">order_size</code>: Size of order (e.g., "100%", "25%")</li>
              <li><code className="text-blue-600 dark:text-blue-400">position_size</code>: Target position size (e.g., "1" for full, "0" to close)</li>
              <li><code className="text-blue-600 dark:text-blue-400">timestamp</code>: ISO string (optional, added if missing)</li>
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Webhook URL</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {botId 
              ? "Use this unique webhook URL to send trading signals to your bot:"
              : "After creating your bot, you'll get a unique webhook URL in this format:"}
          </p>
          <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2 rounded-md">
            <code className="text-sm flex-1">{webhookUrl}</code>
            {botId && <CopyButton value={webhookUrl} />}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Buy Signal Example</h4>
              <CopyButton value={JSON.stringify(buyJson, null, 2)} />
            </div>
            <pre className="relative bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-lg overflow-auto text-sm text-gray-800 dark:text-gray-200">
              {JSON.stringify(buyJson, null, 2)}
            </pre>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Sell Signal Example</h4>
              <CopyButton value={JSON.stringify(sellJson, null, 2)} />
            </div>
            <pre className="relative bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-lg overflow-auto text-sm text-gray-800 dark:text-gray-200">
              {JSON.stringify(sellJson, null, 2)}
            </pre>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Endpoint URL</h4>
            <CopyButton value="https://signals.signum.money/trading" />
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-lg font-mono text-sm text-gray-800 dark:text-gray-200">
            https://signals.signum.money/trading
          </div>
        </div>
      </div>
    </Card>
  )
}
