/** Pure helpers for the paper strategy dashboard. */

export interface PaperTradeRow {
  id: string
  bot_id: string
  symbol: string
  side: string
  size: number | string
  price: number | string | null
  pnl: number | string | null
  external_id: string
  created_at: string
}

export interface StrategyStatusRow {
  bot_id: string
  name: string
  enabled: boolean
  timeframe: string
  last_candle_time: string | null
  last_signal_at: string | null
  kill_switch_tripped_at?: string | null
  allow_testnet?: boolean
  max_orders_per_day?: number
  last_signal: string | null
  bots: { name: string; pair: string } | null
}

export const isPaperTrade = (t: Pick<PaperTradeRow, 'external_id'>) => t.external_id.startsWith('paper-')

export interface PaperPnl {
  realized: number
  closedTrades: number
  wins: number
  winRate: number
  byBot: Record<string, { realized: number; closedTrades: number; openSize: number }>
}

/**
 * Realized PnL from paper trades (FIFO per bot+symbol, long only like saveTrade's buy→sell PnL).
 * Recomputed client-side instead of trusting the stored pnl column, which is null for unmatched sells.
 */
export function computePaperPnl(rows: PaperTradeRow[]): PaperPnl {
  const sorted = rows.filter(isPaperTrade).slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
  const lots = new Map<string, { size: number; price: number }[]>()
  const byBot: PaperPnl['byBot'] = {}
  let realized = 0, closedTrades = 0, wins = 0
  for (const t of sorted) {
    const size = Number(t.size), price = Number(t.price)
    if (!(size > 0) || !(price > 0)) continue
    const key = `${t.bot_id}|${t.symbol}`
    const q = lots.get(key) ?? []
    lots.set(key, q)
    const bot = (byBot[t.bot_id] ??= { realized: 0, closedTrades: 0, openSize: 0 })
    if (t.side === 'buy') { q.push({ size, price }); continue }
    if (t.side !== 'sell') continue
    let remaining = size, pnl = 0, matched = false
    while (remaining > 1e-12 && q.length) {
      const lot = q[0]
      const used = Math.min(lot.size, remaining)
      pnl += (price - lot.price) * used
      lot.size -= used; remaining -= used; matched = true
      if (lot.size <= 1e-12) q.shift()
    }
    if (!matched) continue
    realized += pnl; bot.realized += pnl
    closedTrades++; bot.closedTrades++
    if (pnl > 0) wins++
  }
  for (const [key, q] of lots) byBot[key.split('|')[0]].openSize += q.reduce((a, l) => a + l.size, 0)
  return { realized: round(realized), closedTrades, wins, winRate: closedTrades ? wins / closedTrades : 0, byBot }
}

export type StrategyHealth = 'disabled' | 'waiting' | 'ok' | 'stale' | 'stopped'

const TF_MS: Record<string, number> = { '1m': 6e4, '5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5, '1d': 864e5 }

/** stale = enabled but no processed candle for > 3 timeframes (cron not running?). */
export function strategyHealth(s: Pick<StrategyStatusRow, 'enabled' | 'timeframe' | 'last_candle_time' | 'kill_switch_tripped_at'>, now: number): StrategyHealth {
  if (s.kill_switch_tripped_at) return 'stopped'
  if (!s.enabled) return 'disabled'
  if (!s.last_candle_time) return 'waiting'
  const tf = TF_MS[s.timeframe] ?? 36e5
  return now - Date.parse(s.last_candle_time) > 4 * tf ? 'stale' : 'ok'
}

const round = (v: number) => Math.round(v * 1e8) / 1e8
