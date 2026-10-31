'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { SAMPLE_PINE } from '@/lib/strategy/samples'
import { PUBLIC_EXCHANGES, TIMEFRAMES } from '@/lib/strategy/exchanges'

type Trade = { id: string; direction: string; entryTime: number; entryPrice: number; exitTime: number; exitPrice: number; pnlPct: number; exitReason: string; open?: boolean }
type Preview =
  | { ok: false; error: string }
  | {
      ok: true; mode: 'paper'; via: string; warnings: string[]; definition: unknown; candleSource: string
      candleCount: number; candles: { time: number; close: number }[]
      signals: { index: number; action: string; id: string; direction?: string }[]
      trades: Trade[]; totalReturnPct: number; winRate: number
    }

export default function StrategyPage() {
  const [pine, setPine] = useState<string>(SAMPLE_PINE.emaCross)
  const [result, setResult] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'sample' | 'exchange'>('sample')
  const [exchange, setExchange] = useState<string>('binance')
  const [symbol, setSymbol] = useState('BTC/USDT')
  const [timeframe, setTimeframe] = useState<string>('1h')
  const [bots, setBots] = useState<{ id: string; name: string; pair: string }[]>([])
  const [botId, setBotId] = useState('')
  const [quoteSize, setQuoteSize] = useState(100)
  const [enabled, setEnabled] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    createClient().from('bots').select('id, name, pair').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) { setBots(data); if (data[0]) setBotId(data[0].id) } })
  }, [])

  async function save() {
    if (!botId) return
    setSaving(true); setSaveMsg(null)
    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(botId)}/strategy`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pine, timeframe, paperQuoteSize: quoteSize, enabled }),
      })
      const data = await res.json().catch(() => ({}))
      setSaveMsg(res.ok
        ? { ok: true, text: `Saved (${enabled ? 'enabled' : 'disabled'}, paper, ${timeframe}).` }
        : { ok: false, text: data.error ?? `HTTP ${res.status}` })
    } catch (e) {
      setSaveMsg({ ok: false, text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  async function run() {
    setLoading(true)
    try {
      const res = await fetch('/api/strategy/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pine,
          candles: source === 'sample' ? 'sample' : { exchange, symbol: symbol.trim().toUpperCase(), timeframe, limit: 500 },
        }),
      })
      const data = await res.json()
      setResult(data.ok === undefined ? { ok: false, error: data.error ?? `HTTP ${res.status}` } : data)
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Pine strategy (preview)</h1>
        <p className="text-sm text-muted-foreground">
          Paste a Pine v5 strategy. Supported: ta.sma/ema/rsi/crossover/crossunder, strategy.entry/close.
          <span className="ml-1 rounded bg-yellow-100 px-1 text-yellow-900">Paper mode — no real orders.</span>
        </p>
      </div>
      <div className="flex gap-2">
        {Object.entries(SAMPLE_PINE).map(([k, v]) => (
          <Button key={k} variant="outline" size="sm" onClick={() => setPine(v)}>{k}</Button>
        ))}
      </div>
      <textarea
        className="h-64 w-full rounded border p-3 font-mono text-sm"
        value={pine}
        onChange={(e) => setPine(e.target.value)}
        spellCheck={false}
      />
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">Candles
          <select className="rounded border p-2" value={source} onChange={(e) => setSource(e.target.value as 'sample' | 'exchange')}>
            <option value="sample">Sample (offline)</option>
            <option value="exchange">Exchange public data</option>
          </select>
        </label>
        {source === 'exchange' && (
          <>
            <label className="flex flex-col gap-1">Exchange
              <select className="rounded border p-2" value={exchange} onChange={(e) => setExchange(e.target.value)}>
                {PUBLIC_EXCHANGES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">Symbol
              <input className="w-36 rounded border p-2" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="BTC/USDT" />
            </label>
            <label className="flex flex-col gap-1">Timeframe
              <select className="rounded border p-2" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                {TIMEFRAMES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          </>
        )}
        <Button onClick={run} disabled={loading}>{loading ? 'Running…' : 'Convert & backtest'}</Button>
      </div>

      <section className="space-y-3 rounded border p-4 text-sm">
        <h2 className="font-semibold">Save to bot (paper)</h2>
        {bots.length === 0 ? <p className="text-muted-foreground">No bots yet.</p> : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">Bot
              <select className="rounded border p-2" value={botId} onChange={(e) => setBotId(e.target.value)}>
                {bots.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.pair})</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">Timeframe
              <select className="rounded border p-2" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                {TIMEFRAMES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">Paper order size (quote)
              <input type="number" min={1} max={1000000} className="w-32 rounded border p-2" value={quoteSize}
                onChange={(e) => setQuoteSize(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enable paper scheduler
            </label>
            <Button onClick={save} disabled={saving || !botId}>{saving ? 'Saving…' : 'Save strategy'}</Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Saved strategies run in paper mode only. Disabled unless you tick the box.</p>
        {saveMsg && <p className={saveMsg.ok ? 'text-green-700' : 'text-red-700'}>{saveMsg.text}</p>}
      </section>

      {result && !result.ok && <pre className="whitespace-pre-wrap rounded bg-red-50 p-3 text-sm text-red-800">{result.error}</pre>}
      {result && result.ok && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Stat label="Return" value={`${result.totalReturnPct.toFixed(2)}%`} />
            <Stat label="Trades" value={String(result.trades.length)} />
            <Stat label="Win rate" value={`${(result.winRate * 100).toFixed(0)}%`} />
            <Stat label="Candles" value={`${result.candleCount} (${result.candleSource})`} />
          </div>
          {result.warnings.map((w) => <p key={w} className="text-sm text-yellow-700">{w}</p>)}
          <details>
            <summary className="cursor-pointer text-sm font-medium">Strategy definition (via {result.via})</summary>
            <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(result.definition, null, 2)}</pre>
          </details>
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>Dir</th><th>Entry</th><th>Exit</th><th>Reason</th><th>PnL %</th></tr></thead>
            <tbody>
              {result.trades.map((t, i) => (
                <tr key={i} className="border-t">
                  <td>{t.direction}</td>
                  <td>{new Date(t.entryTime).toISOString().slice(0, 16)} @ {t.entryPrice}</td>
                  <td>{new Date(t.exitTime).toISOString().slice(0, 16)} @ {t.exitPrice}{t.open ? ' (open)' : ''}</td>
                  <td>{t.exitReason}</td>
                  <td className={t.pnlPct >= 0 ? 'text-green-700' : 'text-red-700'}>{t.pnlPct.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}
