'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/database/client'
import { Button } from "@/components/ui/button"

type Bot = {
  id: string
  name: string
  user_id: string
  exchange: string
  pair: string
  max_position_size: number
  stoploss_percentage: number | null
  status: 'active' | 'paused' | 'stopped'
  webhook_secret: string
  created_at: string
  updated_at: string
}

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null)

  useEffect(() => {
    loadBots()
  }, [])

  async function loadBots() {
    try {
      setError(null)
      const { data, error: loadError } = await supabase
        .from('bots')
        .select('*')
        .order('created_at', { ascending: false })

      if (loadError) throw loadError
      setBots(data || [])
    } catch (err: any) {
      console.error('Error loading bots:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleBot(bot: Bot) {
    try {
      setError(null)
      const { error: toggleError } = await supabase
        .from('bots')
        .update({ status: bot.status === 'active' ? 'paused' : 'active' })
        .eq('id', bot.id)

      if (toggleError) throw toggleError
      loadBots() // Reload the list
    } catch (err: any) {
      console.error('Error toggling bot:', err)
      setError(err.message)
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
      loadBots() // Reload the list
      setShowDeleteDialog(null) // Close dialog
    } catch (err: any) {
      console.error('Error deleting bot:', err)
      setError(err.message)
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{bot.pair}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${bot.max_position_size}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {bot.stoploss_percentage ? `${bot.stoploss_percentage}%` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    bot.status === 'active' 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white' 
                      : bot.status === 'paused' 
                        ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                  }`}>
                    {bot.status === 'active' ? 'Active' : bot.status === 'paused' ? 'Paused' : 'Stopped'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <Link href={`/bots/${bot.id}`}>
                      <Button variant="default" size="sm">View</Button>
                    </Link>
                    <Button 
                      variant={bot.status === 'active' ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => handleToggleBot(bot)}
                    >
                      {bot.status === 'active' ? 'Pause' : 'Activate'}
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
