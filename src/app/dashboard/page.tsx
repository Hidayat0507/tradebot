'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from "next/link"
import { createClient } from '@/utils/supabase/client'
import { StatsCard } from "@/components/dashboard/stats-card"
import MarketOverview from './components/market-overview'
import TradingInsights from './components/trading-insights'
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import LogsTable, { type LogEntry } from '@/components/logs-table'
import TradesTable, { type TradeEntry } from '@/components/trades-table'

export default function DashboardPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [trades, setTrades] = useState<TradeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingTrades, setIsLoadingTrades] = useState(true)
  const supabase = createClient()

  const fetchLogs = useCallback(async () => {
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch logs'
      console.error('Error fetching logs:', message)
      setLogs([])
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  const fetchTrades = useCallback(async () => {
    setIsLoadingTrades(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        return
      }

      // Fetch trades from database
      const { data: dbTrades, error } = await supabase
        .from('trades')
        .select(`
          id,
          bot_id,
          bots (
            name
          ),
          symbol,
          side,
          status,
          size,
          price,
          pnl,
          created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      // Get simulated trades from logs
      const { data: simLogs, error: simError } = await supabase
        .from('logs')
        .select(`
          id,
          bot_id,
          bots (
            name
          ),
          timestamp,
          message,
          details
        `)
        .eq('user_id', user.id)
        .eq('message', 'Simulated trade created (not saved to database)')
        .order('timestamp', { ascending: false })
        .limit(100)

      if (simError) {
        console.error('Supabase error:', simError)
      }

      // Process database trades
      const formattedDbTrades = (dbTrades || []).map(trade => ({
        id: trade.id,
        botId: trade.bot_id,
        botName: trade.bots ? (trade.bots as any).name || 'Unknown Bot' : 'Unknown Bot',
        symbol: trade.symbol,
        side: trade.side,
        status: trade.status,
        size: trade.size,
        price: trade.price,
        pnl: trade.pnl,
        timestamp: trade.created_at,
        simulated: false
      }))

      // Process simulated trades from logs
      const simTrades = (simLogs || []).filter(log => log.details && log.details.trade).map(log => {
        const trade = log.details.trade
        return {
          id: trade.id || log.id,
          botId: trade.bot_id || log.bot_id,
          botName: log.details.botName || (log.bots && Array.isArray(log.bots) && log.bots.length > 0 ? log.bots[0]?.name || 'Unknown Bot' : 'Unknown Bot'),
          symbol: trade.symbol,
          side: trade.side,
          status: trade.status,
          size: trade.size,
          price: trade.price,
          pnl: trade.pnl,
          timestamp: trade.created_at || log.timestamp,
          simulated: true
        }
      })

      // Combine both types of trades
      setTrades([...formattedDbTrades, ...simTrades])
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch trades'
      console.error('Error fetching trades:', message)
      setTrades([])
    } finally {
      setIsLoadingTrades(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchLogs()
    fetchTrades()
  }, [fetchLogs, fetchTrades])

  // Calculate stats
  const activeTrades = trades.filter(t => t.status === 'open' || t.status === 'pending').length
  const totalTrades = trades.length
  const recentPnl = trades
    .filter(t => t.pnl !== null && new Date(t.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000))
    .reduce((sum, trade) => sum + (trade.pnl || 0), 0)

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <div className="mb-4 md:mb-0">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Trading Dashboard
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Comprehensive overview of your trading activities
            </p>
          </div>
          <Link href="/bots/create">
            <Button 
              variant="gradient" 
              size="lg" 
              className="w-full md:w-auto shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1"
            >
              <span className="flex items-center gap-2">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Bot
              </span>
            </Button>
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard 
            title="Active Positions" 
            value={activeTrades.toString()} 
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out"
          />
          <StatsCard 
            title="24h Profit/Loss" 
            value={`$${recentPnl.toFixed(2)}`} 
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out"
          />
          <StatsCard 
            title="Total Trades" 
            value={totalTrades.toString()} 
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out"
          />
        </div>

        {/* Trades Section */}
        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-white">
              <svg 
                className="w-6 h-6 text-blue-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
                />
              </svg>
              Recent Trades
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              Your recent trading activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TradesTable
              trades={trades}
              isLoading={isLoadingTrades}
              onRefresh={fetchTrades}
            />
          </CardContent>
        </Card>

        {/* Market and Positions Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-white">
                <svg 
                  className="w-6 h-6 text-blue-500" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
                  />
                </svg>
                Active Positions
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                Your current open trading positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {activeTrades > 0 ? `${activeTrades} active positions` : 'No active positions'}
                </p>
              </div>
            </CardContent>
          </Card>

          <MarketOverview />
        </div>

        {/* Trading Insights Section */}
        <TradingInsights />

        {/* Activity Logs */}
        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-white">
              <svg 
                className="w-6 h-6 text-blue-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M4 6h16M4 10h16M4 14h16M4 18h16" 
                />
              </svg>
              Activity Logs
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              Recent bot activities and trading operations
            </CardDescription>
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
    </main>
  )
}
