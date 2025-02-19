'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/database/client'
import { Button } from "@/components/ui/button"
import type { Database } from '@/lib/database/schema'

type Bot = Database['public']['Tables']['bots']['Row']

export default function BotDetailsPage() {
  const params = useParams()
  const [bot, setBot] = useState<Bot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)

  useEffect(() => {
    loadBot()
  }, [])

  async function loadBot() {
    try {
      setError(null)
      const { data, error: loadError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', params.id)
        .single()

      if (loadError) throw loadError
      setBot(data)
    } catch (err: any) {
      console.error('Error loading bot:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
    return <div className="p-4">Loading bot details...</div>
  }

  if (!bot) {
    return <div className="p-4">Bot not found</div>
  }

  const webhookUrl = `${window.location.origin}/api/webhook?botId=${bot.id}`

  return (
    <div className="page-container">
      <h1 className="page-title mb-6">{bot.name}</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Bot Details */}
        <div className="content-card">
          <h2 className="section-title mb-4">Bot Configuration</h2>
          <div className="space-y-2">
            <p>Exchange: <span className="font-medium">{bot.exchange}</span></p>
            <p>Trading Pair: <span className="font-medium">{bot.pair}</span></p>
            <p>Max Position Size: <span className="font-medium">${bot.max_position_size}</span></p>
            {bot.stoploss_percentage && (
              <p>Stoploss: <span className="font-medium">{bot.stoploss_percentage}%</span></p>
            )}
            <p>Status: <span className={`px-2 py-1 text-sm font-medium rounded-full ${
              bot.enabled 
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
            }`}>
              {bot.enabled ? 'Active' : 'Inactive'}
            </span></p>
          </div>
        </div>

        {/* Webhook Information */}
        <div className="content-card">
          <h2 className="section-title mb-4">Webhook Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Webhook URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 p-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Webhook Secret
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={bot.webhook_secret}
                  className="flex-1 p-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => copyToClipboard(bot.webhook_secret, setSecretCopied)}
                >
                  {secretCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
              <h3 className="text-sm font-medium mb-2">TradingView Alert Message Example:</h3>
              <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">
{`{
  "symbol": "${bot.pair}",
  "action": "BUY",  // or "SELL"
  "price": {{close}},
  "strategy": "Your Strategy Name",
  "stoplossPercent": 2.5  // Optional
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
