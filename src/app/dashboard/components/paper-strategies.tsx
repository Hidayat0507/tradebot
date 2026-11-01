'use client'

import { friendlyError, requestFailure } from '@/lib/friendly-error'
import { formatDateTime } from '@/lib/format'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { PaperPnl, PaperTradeRow, StrategyHealth, StrategyStatusRow } from '@/lib/strategy/dashboard'

type Data = { strategies: (StrategyStatusRow & { health: StrategyHealth })[]; trades: PaperTradeRow[]; pnl: PaperPnl }

const fmt = (iso: string | null) => formatDateTime(iso)
const HEALTH: Record<StrategyHealth, string> = {
  ok: 'bg-green-100 text-green-800', waiting: 'bg-blue-100 text-blue-800',
  stale: 'bg-yellow-100 text-yellow-900', disabled: 'bg-gray-100 text-gray-700',
}

export default function PaperStrategies() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/strategy/dashboard')
      const json = await res.json()
      if (!res.ok) throw requestFailure(res.status)
      setData(json.data)
    } catch (e) {
      setError(friendlyError(e, 'We could not load paper trading. Please try again.'))
    }
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <Card className="bg-white/70 dark:bg-gray-800/70 rounded-2xl shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-xl font-semibold">Paper trading</CardTitle>
          <CardDescription>Simulated only — no real orders. Pine strategy status, paper trades and paper P&L.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} aria-label="Refresh paper trading">Refresh</Button>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {error && <p className="text-red-700">{error}</p>}
        {!data && !error && <p className="text-muted-foreground">Loading…</p>}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Paper realized PnL" value={data.pnl.realized.toFixed(2)} tone={data.pnl.realized >= 0 ? 'text-green-700' : 'text-red-700'} />
              <Stat label="Closed trades" value={String(data.pnl.closedTrades)} />
              <Stat label="Win rate" value={`${(data.pnl.winRate * 100).toFixed(0)}%`} />
              <Stat label="Strategies enabled" value={`${data.strategies.filter((s) => s.enabled).length}/${data.strategies.length}`} />
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[480px]">
              <thead><tr className="text-left text-muted-foreground"><th>Bot</th><th>Status</th><th>TF</th><th>Last candle</th><th>Last signal</th><th>PnL</th></tr></thead>
              <tbody>
                {data.strategies.length === 0 && <tr><td colSpan={6} className="py-2 text-muted-foreground">No saved strategies yet. <Link href="/strategy" className="text-blue-400 underline">Create one</Link>.</td></tr>}
                {data.strategies.map((s) => (
                  <tr key={s.bot_id} className="border-t">
                    <td>{s.bots?.name ?? s.bot_id} <span className="text-muted-foreground">{s.bots?.pair}</span></td>
                    <td><span className={`rounded px-2 py-0.5 text-xs ${HEALTH[s.health]}`}>{s.health}</span></td>
                    <td>{s.timeframe}</td>
                    <td>{fmt(s.last_candle_time)}</td>
                    <td>{s.last_signal ? `${s.last_signal} (${fmt(s.last_signal_at)})` : '—'}</td>
                    <td>{(data.pnl.byBot[s.bot_id]?.realized ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <div>
              <h3 className="mb-2 font-medium">Recent paper trades</h3>
              <div className="overflow-x-auto"><table className="w-full min-w-[480px]">
                <thead><tr className="text-left text-muted-foreground"><th>Time</th><th>Symbol</th><th>Side</th><th>Size</th><th>Price</th></tr></thead>
                <tbody>
                  {data.trades.length === 0 && <tr><td colSpan={5} className="py-2 text-muted-foreground">No paper trades yet.</td></tr>}
                  {data.trades.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td>{fmt(t.created_at)}</td><td>{t.symbol}</td>
                      <td className={t.side === 'buy' ? 'text-blue-700 dark:text-blue-300' : 'text-purple-700 dark:text-purple-300'}>{t.side}</td>
                      <td>{Number(t.size).toPrecision(6)}</td><td>{t.price ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone ?? ''}`}>{value}</div>
    </div>
  )
}
