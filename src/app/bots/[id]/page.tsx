'use client'

import { useState, useEffect } from 'react'
import { useParams } from "next/navigation"
import { createClient } from '@/utils/supabase/client'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { WebhookSecretSection } from '@/components/bot/WebhookSecretSection';

type Bot = {
  id: string
  user_id: string
  name: string
  exchange: string
  pair: string
  max_position_size: number
  stoploss_percentage?: number
  enabled: boolean
  api_key: string
  api_secret: string
  created_at: string
  updated_at: string
  webhook_secret: string
}

interface BotWithWebhookSecret extends Bot {
  webhook_secret: string;
}

export default function BotDetailsPage() {
  const params = useParams<{ id: string }>()
  const [bot, setBot] = useState<Bot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const loadBot = async () => {
      try {
        setError(null)
        const { data, error: loadError } = await supabase
          .from('bots')
          .select('*')
          .eq('id', params.id)
          .single()

        if (loadError) {
          throw loadError
        }

        setBot(data)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch bot'
        console.error('Failed to fetch bot:', err)
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    loadBot()
  }, [params.id, supabase])

  async function copyToClipboard(text: string, setCopied: (copied: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (loading) {
    return (
      <div className="page-background">
        <div className="page-container">
          <div className="page-content">
            <div className="animate-pulse">Loading bot details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="page-background">
        <div className="page-container">
          <div className="page-content">
            <div className="text-red-500">Bot not found</div>
          </div>
        </div>
      </div>
    )
  }

  const webhookUrl = `${window.location.origin}/api/webhook`

  return (
    <div className="page-background">
      <div className="page-container">
        <div className="page-content">
          <div className="mb-8">
            <h1 className="page-title font-bold text-3xl text-gray-900 dark:text-white">{bot.name}</h1>
            <p className="page-subtitle text-lg text-gray-500 dark:text-gray-300">
              Manage your bot settings and view webhook configuration.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid gap-6">
            <Card className="p-6 bg-white dark:bg-gray-900">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Bot Configuration</h2>
              <div className="grid gap-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-300">Bot ID</span>
                  <span className="font-medium text-gray-900 dark:text-white">{bot.id}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-300">Trading Pair</span>
                  <span className="font-medium text-gray-900 dark:text-white">{bot.pair}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600 dark:text-gray-300">Status</span>
                  <span className={`px-2 py-1 text-sm font-medium rounded-full ${
                    bot.enabled
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {bot.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white dark:bg-gray-900">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Webhook Configuration</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Webhook URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="flex-1 p-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-white"
                    />
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => copyToClipboard(webhookUrl, setWebhookUrlCopied)}
                    >
                      {webhookUrlCopied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-2 text-gray-900 dark:text-white">TradingView Alert Message Example</h3>
                  <div className="space-y-4">
                    <pre className="text-xs bg-white dark:bg-gray-900 p-3 rounded-md overflow-x-auto text-gray-900 dark:text-gray-100">
{`{
  "bot_id": "${bot.id}",
  "symbol": "${bot.pair}",
  "action": "{{strategy.order.action}}",
  "order_size": 50,
  "secret": "${(bot as any).webhook_secret || 'YOUR_WEBHOOK_SECRET'}"
}`}
                    </pre>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <p className="font-medium mb-1">Notes:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Use <code className="text-gray-900 dark:text-gray-200">order_size</code> as percent of balance (e.g., 25, 50, 100).</li>
                        <li><code className="text-gray-900 dark:text-gray-200">symbol</code> must match the exchange format (e.g., Bitget spot: BTC/USDT; Hyperliquid perps: BTC/USDC:USDC).</li>
                        <li>Optional: add <code className="text-gray-900 dark:text-gray-200">price</code> for limit orders, <code className="text-gray-900 dark:text-gray-200">strategy</code>, and <code className="text-gray-900 dark:text-gray-200">stoplossPercent</code>.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <WebhookSecretSection 
              bot={bot as BotWithWebhookSecret} 
              onSecretRegenerated={(newSecret) => {
                // Update bot state with new secret
                setBot(prev => prev ? { ...prev, webhook_secret: newSecret } : null);
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  )
}
