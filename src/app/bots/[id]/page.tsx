'use client'

import { useState, useEffect } from 'react'
import { useParams } from "next/navigation"
import { createClient } from '@/utils/supabase/client'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { WebhookSecretSection } from '@/components/bot/WebhookSecretSection';
import { WebhookExample } from '@/components/bot/WebhookExample'
import { ModeBadge } from '@/components/bot/ModeBadge'
import { formatOrderSizePct, modeOf, ORDER_SIZE } from '@/lib/bot-config'
import { secretDisplay, secretForExample } from '@/lib/webhook-secret-display'

type Bot = {
  mode: 'live' | 'paper'
  id: string
  user_id: string
  name: string
  exchange: string
  pair: string
  max_position_size: number
  stoploss_percentage?: number
  enabled: boolean
  created_at: string
  updated_at: string
  webhook_secret: string
}

export default function BotDetailsPage() {
  const params = useParams<{ id: string }>()
  const [bot, setBot] = useState<Bot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [freshSecret, setFreshSecret] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const loadBot = async () => {
      try {
        setError(null)
        const { data, error: loadError } = await supabase
          .from('bots')
          .select('id, user_id, name, exchange, pair, max_position_size, stoploss_percentage, enabled, mode, webhook_secret, created_at, updated_at')
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

  const secretState = secretDisplay(bot.webhook_secret, freshSecret)

  return (
    <div className="page-background">
      <div className="page-container">
        <div className="page-content">
          <div className="mb-8">
            <h1 className="page-title font-bold text-3xl text-gray-900 dark:text-white flex items-center gap-3">{bot.name} <ModeBadge mode={modeOf(bot)} /></h1>
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
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-300">Mode</span>
                  <ModeBadge mode={modeOf(bot)} />
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-300" title={ORDER_SIZE.help}>{ORDER_SIZE.label}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatOrderSizePct(bot.max_position_size)}</span>
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
              <WebhookExample botId={bot.id} pair={bot.pair} secret={secretState.kind === 'fresh' ? secretForExample(secretState) : undefined} />
            </Card>

            <WebhookSecretSection
              bot={bot}
              freshSecret={freshSecret}
              onSecretRegenerated={(newSecret) => setFreshSecret(newSecret)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
