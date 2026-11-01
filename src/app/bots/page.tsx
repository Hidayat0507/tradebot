'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Button } from "@/components/ui/button"
import { ModeBadge } from '@/components/bot/ModeBadge'
import { formatOrderSizePct, modeOf, ORDER_SIZE } from '@/lib/bot-config'
import { botStatusLabel } from '@/lib/format'

type Bot = {
  mode?: 'live' | 'paper' | 'testnet'
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
}

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null)
  const supabase = createClient()

  const handleError = useCallback((err: unknown) => {
    console.error('Bots operation failed:', err)
    const message = err instanceof Error ? err.message : 'Unexpected error'
    setError(message)
  }, [])

  const loadBots = useCallback(async () => {
    try {
      setError(null)
      const { data, error: loadError } = await supabase
        .from('bots')
        .select('id, user_id, name, exchange, pair, max_position_size, stoploss_percentage, enabled, mode, created_at, updated_at')
        .order('created_at', { ascending: false })

      if (loadError) throw loadError
      setBots(data || [])
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }, [handleError, supabase])

  useEffect(() => {
    loadBots()
  }, [loadBots])

  async function handleToggleBot(bot: Bot) {
    try {
      setError(null)
      const { error: toggleError } = await supabase
        .from('bots')
        .update({ enabled: !bot.enabled })
        .eq('id', bot.id)

      if (toggleError) throw toggleError
      await loadBots() // Reload the list
    } catch (err) {
      handleError(err)
    }
  }

  async function handleDeleteBot(botId: string) {
    try {
      setError(null)
      const { error: deleteError } = await supabase
        .from('bots')
        .delete()
        .eq('id', botId)

      if (deleteError) throw deleteError
      await loadBots() // Reload the list
      setShowDeleteDialog(null) // Close dialog
    } catch (err) {
      handleError(err)
    }
  }

  if (loading) {
    return <div className="p-4">Loading bots...</div>
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Your Bots</h1>
        <Button asChild size="sm"><Link href="/bots/create">+ Create bot</Link></Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      <ul className="md:hidden space-y-3" aria-label="Bots">
        {bots.map(bot => (
          <li key={bot.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 break-words">{bot.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{bot.exchange} · {bot.pair}</p>
              </div>
              <ModeBadge mode={modeOf(bot)} />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Order size</dt><dd>{formatOrderSizePct(bot.max_position_size)}</dd></div>
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Stoploss</dt><dd>{bot.stoploss_percentage ? `${bot.stoploss_percentage}%` : '-'}</dd></div>
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Status</dt><dd>{botStatusLabel(bot.enabled)}</dd></div>
            </dl>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button asChild variant="default" size="sm"><Link href={`/bots/${bot.id}`}>View</Link></Button>
              <Button variant={bot.enabled ? "secondary" : "primary"} size="sm" onClick={() => handleToggleBot(bot)}>{bot.enabled ? 'Pause' : 'Activate'}</Button>
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(bot.id)} aria-label={`Delete ${bot.name}`}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Exchange</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pair</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stoploss</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {bots.map(bot => (
              <tr key={bot.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{bot.name} <ModeBadge mode={modeOf(bot)} className="ml-2" /></td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{bot.exchange}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{bot.pair}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" title={ORDER_SIZE.help}>{formatOrderSizePct(bot.max_position_size)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {bot.stoploss_percentage ? `${bot.stoploss_percentage}%` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    bot.enabled 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {botStatusLabel(bot.enabled)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <Link href={`/bots/${bot.id}`}>
                      <Button variant="default" size="sm">View</Button>
                    </Link>
                    <Button 
                      variant={bot.enabled ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => handleToggleBot(bot)}
                    >
                      {bot.enabled ? 'Pause' : 'Activate'}
                    </Button>
                    <Button 
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(bot.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">Delete Bot</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Are you sure you want to delete this bot? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button 
                variant="default"
                size="sm"
                onClick={() => setShowDeleteDialog(null)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteBot(showDeleteDialog)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
