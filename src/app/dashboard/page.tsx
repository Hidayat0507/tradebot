'use client'

import { useState, useEffect } from 'react'
import Link from "next/link"
import { createClient } from '@/utils/supabase/client'
import { StatsCard } from "@/components/dashboard/stats-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import LogsTable, { type LogEntry } from '@/components/logs-table'

export default function DashboardPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        return
      }

      const { data, error } = await supabase
        .from('logs')
        .select(`
          id,
          bot_id,
          bots (
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

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      setLogs((data || []).map(log => ({
        id: log.id,
        botId: log.bot_id,
        botName: log.bots ? log.bots[0]?.name || 'Unknown Bot' : 'Unknown Bot',
        timestamp: log.timestamp,
        type: log.type,
        message: log.message,
        details: log.details
      })))
    } catch (error: any) {
      console.error('Error fetching logs:', error.message || error)
      setLogs([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Trading Dashboard</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Monitor your trading performance and manage your bots</p>
            </div>
            <Link href="/bots/create">
              <Button variant="gradient" size="lg" className="shadow-lg hover:shadow-xl transition-shadow">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Create Bot
                </span>
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            <StatsCard 
              title="Active Positions" 
              value="0" 
              className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            />
            <StatsCard 
              title="24h Profit/Loss" 
              value="$0.00" 
              className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            />
            <StatsCard 
              title="Total Trades" 
              value="0" 
              className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            />
          </div>

          <div className="mt-8 grid gap-4 sm:gap-6 lg:grid-cols-2">
            <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Active Positions
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Your current open trading positions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-32 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-800 dark:text-gray-200">No active positions</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Recent Trades
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Your latest completed trades</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-32 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-800 dark:text-gray-200">No recent trades</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Activity Logs
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Recent bot activities and trading operations</CardDescription>
              </CardHeader>
              <CardContent>
                <LogsTable
                  logs={logs}
                  isLoading={isLoading}
                  onRefresh={fetchLogs}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
