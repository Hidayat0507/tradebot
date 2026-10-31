'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from "next/link"
import { createClient } from '@/utils/supabase/client'
import { StatsCard } from "@/components/dashboard/stats-card"
import MarketOverview from './components/market-overview'
import TradingInsights from './components/trading-insights'
import ActivePositions from './components/active-positions'
import PaperStrategies from './components/paper-strategies'
import { splitByMode } from '@/lib/pnl-split'
import { isPaperTradeId } from '@/lib/bot-config'
import { resolveBotName } from '@/lib/format'
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

  // Bot names by id: fallback when the embedded join is missing (e.g. deleted FK, older rows)
  const loadBotNames = useCallback(async () => {
    const { data } = await supabase.from('bots').select('id, name')
    return new Map<string, string>((data || []).map((b: { id: string; name: string }) => [b.id, b.name]))
  }, [supabase])

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        return
      }
      const botNames = await loadBotNames()

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
        botName: resolveBotName(log.bots, log.bot_id, botNames),
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
  }, [supabase, loadBotNames])

  const fetchTrades = useCallback(async () => {
    setIsLoadingTrades(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        return
      }
      const botNames = await loadBotNames()

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
          external_id,
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
        botName: resolveBotName(trade.bots, trade.bot_id, botNames),
        symbol: trade.symbol,
        side: trade.side,
        status: trade.status,
        size: trade.size,
        price: trade.price,
        pnl: trade.pnl,
        timestamp: trade.created_at,
        simulated: false,
        paper: isPaperTradeId((trade as { external_id?: string }).external_id),
      }))

      // Process simulated trades from logs
      const simTrades = (simLogs || []).filter(log => log.details && log.details.trade).map(log => {
        const trade = log.details.trade
        return {
          id: trade.id || log.id,
          botId: trade.bot_id || log.bot_id,
          botName: log.details.botName || resolveBotName(log.bots, trade.bot_id || log.bot_id, botNames),
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
  }, [supabase, loadBotNames])

  useEffect(() => {
    fetchLogs()
    fetchTrades()
  }, [fetchLogs, fetchTrades])

  // Calculate stats
  const split = splitByMode(trades)
  const activeTrades = split.liveTrades.filter(t => t.status === 'open' || t.status === 'pending').length
  const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`

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

        {/* Stats Overview: live (real money) and paper (simulated) never mixed */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="kpis">
          <StatsCard
            title="Live P&L (24h)"
            value={money(split.live.pnl24h)}
            description={`Real orders · ${split.live.trades} trades`}
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg ring-1 ring-rose-500/30"
          />
          <StatsCard
            title="Paper P&L (24h)"
            value={money(split.paper.pnl24h)}
            description={`Simulated, no real money · ${split.paper.trades} trades`}
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg ring-1 ring-amber-400/30"
          />
          <StatsCard
            title="Open live positions"
            value={activeTrades.toString()}
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg"
          />
          <StatsCard
            title="Total trades"
            value={`${split.live.trades} live · ${split.paper.trades} paper`}
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg"
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

        {/* In-app Pine strategies (paper) */}
        <PaperStrategies />

        {/* Active Positions Section with Unrealized P&L */}
        <ActivePositions trades={split.liveTrades} />

        {/* Market Overview Section */}
        <MarketOverview />

        {/* Trading Insights Section */}
        <TradingInsights trades={split.liveTrades} />

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
