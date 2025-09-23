'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import LogsTable, { type LogEntry } from '@/components/logs-table'

type DbLogType = 'info' | 'warning' | 'error' | 'success'

type RawLogResponse = {
  id: string
  bot_id: string
  bots?: Array<{ name?: string | null }> | null
  timestamp: string
  type: DbLogType
  message: string
  details?: Record<string, unknown> | null
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('logs')
        .select(`
          id,
          bot_id,
          bots:bots (
            name
          ),
          timestamp,
          type,
          message,
          details
        `)
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(100)

      if (error) throw error

      const typedData = (data ?? []) as RawLogResponse[]

      setLogs(typedData.map(log => ({
        id: log.id,
        botId: log.bot_id,
        botName: log.bots && Array.isArray(log.bots) && log.bots.length > 0 ? log.bots[0]?.name || 'Unknown Bot' : 'Unknown Bot',
        timestamp: log.timestamp,
        type: log.type,
        message: log.message,
        details: log.details || undefined
      })))
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <div className="container py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Activity Logs</h1>
          <p className="text-[0.9rem] text-muted-foreground">
            View your trading bot activity and operation logs
          </p>
        </div>

        <LogsTable
          logs={logs}
          isLoading={isLoading}
          onRefresh={fetchLogs}
        />
      </div>
    </div>
  )
}
