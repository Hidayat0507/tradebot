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

  const kpiCls = 'bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-sm'
  const sections = [
    { id: 'positions', label: 'Positions' },
    { id: 'trades', label: 'Trades' },
    { id: 'strategies', label: 'Paper strategies' },
    { id: 'insights', label: 'Insights' },
    { id: 'logs', label: 'Logs' },
    { id: 'market', label: 'Market' },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 px-3 py-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">Live and paper activity, kept separate.</p>
          </div>
          <Button asChild variant="gradient" size="sm" className="shrink-0">
            <Link href="/bots/create">+ Create bot</Link>
          </Button>
        </div>

        <nav aria-label="Dashboard sections" className="-mx-3 px-3 overflow-x-auto">
          <ul className="flex gap-2 text-sm whitespace-nowrap">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-block rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* KPIs: live (real money) and paper (simulated) never mixed */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpis">
          <StatsCard title="Live P&L (24h)" value={money(split.live.pnl24h)} description={`Real orders · ${split.live.trades} trades`} className={`${kpiCls} ring-1 ring-rose-500/30`} />
          <StatsCard title="Paper P&L (24h)" value={money(split.paper.pnl24h)} description={`Simulated · ${split.paper.trades} trades`} className={`${kpiCls} ring-1 ring-amber-400/30`} />
          <StatsCard title="Open live positions" value={activeTrades.toString()} className={kpiCls} />
          <StatsCard title="Total trades" value={`${split.live.trades} live · ${split.paper.trades} paper`} className={kpiCls} />
        </div>

        <section id="positions" className="scroll-mt-20"><ActivePositions trades={split.liveTrades} /></section>

        <section id="trades" className="scroll-mt-20">
          <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Recent trades</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">Live and paper, labelled per row</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <TradesTable trades={trades} isLoading={isLoadingTrades} onRefresh={fetchTrades} />
            </CardContent>
          </Card>
        </section>

        <section id="strategies" className="scroll-mt-20"><PaperStrategies /></section>

        <section id="insights" className="scroll-mt-20"><TradingInsights trades={split.liveTrades} /></section>

        <section id="logs" className="scroll-mt-20">
          <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Activity logs</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">Recent bot activity and order operations</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <LogsTable logs={logs} isLoading={isLoading} onRefresh={fetchLogs} />
            </CardContent>
          </Card>
        </section>

        <section id="market" className="scroll-mt-20"><MarketOverview /></section>
      </div>
    </main>
  )
}
