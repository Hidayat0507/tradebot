'use client'

import { formatDateTime } from '@/lib/format'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { SAMPLE_PINE } from '@/lib/strategy/samples'
import { PUBLIC_EXCHANGES, TIMEFRAMES } from '@/lib/strategy/exchanges'
import { friendlyPineError, SUPPORTED_PINE } from '@/lib/strategy/friendly-error'

/** Shared dark-theme-safe field style (matches components/ui/input). */
const FIELD = 'rounded-lg border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
const SAMPLE_LABELS: Record<string, string> = { emaCross: 'EMA cross', rsi: 'RSI reversion', smaLongShort: 'SMA long/short', macdAtrStops: 'MACD + ATR stops' }

type Trade = { id: string; direction: string; entryTime: number; entryPrice: number; exitTime: number; exitPrice: number; pnlPct: number; exitReason: string; open?: boolean }
type Preview =
  | { ok: false; error: string; status?: number }
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
  const [bots, setBots] = useState<{ id: string; name: string; pair: string; mode: string }[]>([])
  const [botId, setBotId] = useState('')
  const [quoteSize, setQuoteSize] = useState(100)
  const [enabled, setEnabled] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [previewPine, setPreviewPine] = useState('')
  const [allowTestnet, setAllowTestnet] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [maxOrders, setMaxOrders] = useState(5)
  const testnetBot = bots.find(b => b.id === botId)?.mode === 'testnet'
  const sandbox = testnetBot && allowTestnet
  useEffect(() => { setReviewed(false); setAllowTestnet(false) }, [pine, botId, result])

  useEffect(() => {
    createClient().from('bots').select('id, name, pair, mode').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) { setBots(data); if (data[0]) setBotId(data[0].id) } })
  }, [])

  async function save() {
    if (!botId) return
    setSaving(true); setSaveMsg(null)
    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(botId)}/strategy`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pine, timeframe, paperQuoteSize: quoteSize, enabled, allow_testnet: sandbox, max_orders_per_day: maxOrders, reviewed_rules: reviewed }),
      })
      const data = await res.json().catch(() => ({}))
      setSaveMsg(res.ok
        ? { ok: true, text: `Saved (${enabled ? 'enabled' : 'disabled'}, ${sandbox ? 'testnet' : 'paper'}, ${timeframe}).` }
        : { ok: false, text: (() => { const f = friendlyPineError(data.error ?? '', pine, res.status === 422 ? undefined : res.status); return `${f.title}${f.line ? ` (line ${f.line})` : ''}. ${f.hint}` })() })
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
      setPreviewPine(pine)
      setResult(data.ok === undefined || !res.ok ? { ok: false, error: data.error ?? `HTTP ${res.status}`, status: res.ok || res.status === 422 ? undefined : res.status } : data)
    } catch {
      setResult({ ok: false, error: 'Network error — check your connection and try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Strategies</h1>
        <p className="text-sm text-muted-foreground">
          Try out a trading idea before risking real money. Pick an example below, see how it would have
          performed on past prices, then save it to a bot to run in paper mode.
          <span className="ml-2 rounded bg-amber-400/15 px-2 py-0.5 text-amber-300 ring-1 ring-amber-400/40">{sandbox && enabled ? 'This places real sandbox orders — mock funds' : 'Paper mode — no real orders'}</span>
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>Pick an example strategy below, or paste your own Pine Script (the language TradingView alerts use).</li>
          <li>Click &quot;Convert &amp; backtest&quot; to see how it would have performed.</li>
          <li>Choose a bot and timeframe, then save it — paper is the default; testnet bots can opt into sandbox orders.</li>
        </ol>
      </div>
      <label className="flex items-center justify-end gap-2 text-sm text-gray-400">
        <input type="checkbox" className="h-4 w-4 accent-amber-400" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
        Advanced (engine &amp; JSON details)
      </label>
      {showAdvanced && (
        <details className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 text-sm text-gray-300">
          <summary className="cursor-pointer font-medium text-gray-100">What Pine is supported?</summary>
          <ul className="mt-2 space-y-1">
            <li><span className="text-gray-400">Indicators:</span> {SUPPORTED_PINE.indicators.join(', ')}</li>
            <li><span className="text-gray-400">Orders:</span> {SUPPORTED_PINE.orders.join(', ')}</li>
            <li><span className="text-gray-400">Also:</span> {SUPPORTED_PINE.other.join(', ')}</li>
          </ul>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-sm text-gray-400">Examples:</span>
        {Object.entries(SAMPLE_PINE).map(([k, v]) => (
          <Button key={k} variant="outline" size="sm" onClick={() => setPine(v)}>{SAMPLE_LABELS[k] ?? k}</Button>
        ))}
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-medium">I have my own Pine Script / edit this example</summary>
        <textarea
          className={`${FIELD} h-64 w-full p-3 font-mono text-sm`}
          aria-label="Pine Script source"
          value={pine}
          onChange={(e) => setPine(e.target.value)}
          spellCheck={false}
        />
      </details>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">Candles
          <select className={`${FIELD} p-2`} value={source} onChange={(e) => setSource(e.target.value as 'sample' | 'exchange')}>
            <option value="sample">Sample (offline)</option>
            <option value="exchange">Exchange public data</option>
          </select>
        </label>
        {source === 'exchange' && (
          <>
            <label className="flex flex-col gap-1">Exchange
              <select className={`${FIELD} p-2`} value={exchange} onChange={(e) => setExchange(e.target.value)}>
                {PUBLIC_EXCHANGES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">Symbol
              <input className={`${FIELD} w-36 p-2`} value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="BTC/USDT" />
            </label>
            <label className="flex flex-col gap-1">Timeframe
              <select className={`${FIELD} p-2`} value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                {TIMEFRAMES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          </>
        )}
        <Button onClick={run} disabled={loading}>{loading ? 'Running…' : 'Convert & backtest'}</Button>
      </div>

      <section className="space-y-3 rounded border p-4 text-sm">
        <h2 className="font-semibold">Save to bot ({sandbox ? 'testnet' : 'paper'})</h2>
        {bots.length === 0 ? <p className="text-muted-foreground">No bots yet.</p> : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">Bot
              <select className={`${FIELD} p-2`} value={botId} onChange={(e) => setBotId(e.target.value)}>
                {bots.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.pair})</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">Timeframe
              <select className={`${FIELD} p-2`} value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                {TIMEFRAMES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">Order size (quote)
              <input type="number" min={1} max={1000000} className={`${FIELD} w-32 p-2`} value={quoteSize}
                onChange={(e) => setQuoteSize(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" className="h-4 w-4 accent-amber-400" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enable strategy scheduler
            </label>
            <Button onClick={save} disabled={saving || !botId || (sandbox && !reviewed)}>{saving ? 'Saving…' : 'Save strategy'}</Button>
          </div>
        )}
        {testnetBot && <div className="space-y-3 rounded border border-amber-500 p-3">
          <p className="font-semibold">Testnet — real sandbox orders, mock funds</p>
          {result?.ok && <details open><summary>Converted rules to review</summary><pre className="max-h-64 overflow-auto text-xs">{JSON.stringify(result.definition, null, 2)}</pre></details>}
          <label className="flex gap-2"><input type="checkbox" checked={reviewed} disabled={!result?.ok || previewPine !== pine}
            onChange={e => { setReviewed(e.target.checked); if (!e.target.checked) setAllowTestnet(false) }} />I reviewed the converted rules above</label>
          <label className="flex gap-2"><input type="checkbox" checked={allowTestnet} disabled={!reviewed}
            onChange={e => setAllowTestnet(e.target.checked)} />Allow testnet sandbox orders</label>
          <label>Maximum orders per UTC day <input className={`${FIELD} w-20 p-2`} type="number" min={1} max={50} value={maxOrders} onChange={e => setMaxOrders(Number(e.target.value))} /></label>
          <p>Stops after the daily cap or 3 losing closes in a row. Clear explicitly from the dashboard.</p>
        </div>}
        <p className="text-xs text-muted-foreground">Paper by default. Testnet requires review and opt-in. Disabled unless you tick the box.</p>
        {saveMsg && <p className={saveMsg.ok ? 'text-green-700' : 'text-red-700'}>{saveMsg.text}</p>}
      </section>

      {result && !result.ok && (() => {
        const f = friendlyPineError(result.error, pine, result.status)
        return (
          <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm" data-testid="pine-error">
            <p className="font-semibold text-red-200">{f.title}{f.line ? ` (line ${f.line})` : ''}</p>
            {f.lineText && <pre className="mt-2 overflow-x-auto rounded bg-gray-950 p-2 font-mono text-xs text-red-100"><span className="mr-3 select-none text-gray-500">{f.line}</span>{f.lineText}</pre>}
            <p className="mt-2 text-gray-200">{f.hint}</p>
          </div>
        )
      })()}
      {result && result.ok && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Stat label="Return" value={`${result.totalReturnPct.toFixed(2)}%`} />
            <Stat label="Trades" value={String(result.trades.length)} />
            <Stat label="Win rate" value={`${(result.winRate * 100).toFixed(0)}%`} />
            <Stat label="Candles" value={`${result.candleCount} (${result.candleSource})`} />
          </div>
          {result.warnings.map((w) => <p key={w} className="text-sm text-yellow-700">{w}</p>)}
          {showAdvanced && (
            <details>
              <summary className="cursor-pointer text-sm font-medium">Strategy definition (via {result.via})</summary>
              <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(result.definition, null, 2)}</pre>
            </details>
          )}
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
            <thead><tr className="text-left"><th>Dir</th><th>Entry</th><th>Exit</th><th>Reason</th><th>PnL %</th></tr></thead>
            <tbody>
              {result.trades.map((t, i) => (
                <tr key={i} className="border-t">
                  <td>{t.direction}</td>
                  <td>{formatDateTime(t.entryTime)} @ {t.entryPrice}</td>
                  <td>{formatDateTime(t.exitTime)} @ {t.exitPrice}{t.open ? ' (open)' : ''}</td>
                  <td>{t.exitReason}</td>
                  <td className={t.pnlPct >= 0 ? 'text-green-700' : 'text-red-700'}>{t.pnlPct.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
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
