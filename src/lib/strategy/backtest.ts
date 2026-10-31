import { evaluate } from './runtime'
import type { Candle, Signal, StrategyDefinition } from './types'

export interface Trade {
  id: string
  direction: 'long' | 'short'
  entryTime: number
  entryPrice: number
  exitTime: number
  exitPrice: number
  pnlPct: number
  open?: boolean
}

export interface BacktestResult {
  mode: 'paper'
  signals: Signal[]
  trades: Trade[]
  totalReturnPct: number
  winRate: number
}

/** Paper backtest: one position, fills at next bar open, entry in opposite direction reverses. */
export function backtest(def: StrategyDefinition, candles: Candle[], feePct = 0.1): BacktestResult {
  const signals = evaluate(def, candles)
  const trades: Trade[] = []
  let pos: { id: string; direction: 'long' | 'short'; entryTime: number; entryPrice: number } | null = null
  const byBar = new Map<number, Signal[]>()
  for (const s of signals) byBar.set(s.index, [...(byBar.get(s.index) ?? []), s])
  const closePos = (time: number, price: number, open = false) => {
    if (!pos) return
    const raw = pos.direction === 'long' ? price / pos.entryPrice - 1 : pos.entryPrice / price - 1
    trades.push({ ...pos, exitTime: time, exitPrice: price, pnlPct: round((raw * 100) - 2 * feePct), ...(open ? { open } : {}) })
    pos = null
  }
  for (let i = 0; i < candles.length - 1; i++) {
    const fill = candles[i + 1]
    for (const s of byBar.get(i) ?? []) {
      if (s.action === 'close_all' || (s.action === 'close' && pos?.id === s.id)) closePos(fill.time, fill.open)
      else if (s.action === 'entry' && s.direction) {
        if (pos && pos.direction === s.direction) continue
        closePos(fill.time, fill.open)
        pos = { id: s.id, direction: s.direction, entryTime: fill.time, entryPrice: fill.open }
      }
    }
  }
  const last = candles[candles.length - 1]
  if (last) closePos(last.time, last.close, true)
  const total = trades.reduce((acc, t) => acc * (1 + t.pnlPct / 100), 1)
  const wins = trades.filter((t) => t.pnlPct > 0).length
  return {
    mode: 'paper',
    signals,
    trades,
    totalReturnPct: round((total - 1) * 100),
    winRate: trades.length ? round(wins / trades.length) : 0,
  }
}

const round = (v: number) => Math.round(v * 10000) / 10000
