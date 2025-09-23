'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Button } from "@/components/ui/button"

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
        .select('*')
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
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Exchange</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pair</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Max Position</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stoploss</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {bots.map(bot => (
              <tr key={bot.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{bot.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{bot.exchange}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{bot.pair}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${bot.max_position_size}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {bot.stoploss_percentage ? `${bot.stoploss_percentage}%` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    bot.enabled 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {bot.enabled ? 'Active' : 'Paused'}
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
