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
  exitReason: 'signal' | 'stop' | 'limit' | 'end'
  open?: boolean
}

export interface BacktestResult {
  mode: 'paper'
  signals: Signal[]
  trades: Trade[]
  totalReturnPct: number
  winRate: number
}

/**
 * Paper backtest: one position; market orders fill at next bar open; an entry in the opposite
 * direction reverses. strategy.exit stop/limit orders placed at bar close are active from the
 * next bar; if both are hit in one bar the stop is assumed first (conservative).
 */
export function backtest(def: StrategyDefinition, candles: Candle[], feePct = 0.1): BacktestResult {
  const signals = evaluate(def, candles)
  const trades: Trade[] = []
  let pos: { id: string; direction: 'long' | 'short'; entryTime: number; entryPrice: number } | null = null
  let exitOrder: { fromEntry?: string; stop?: number; limit?: number } | null = null
  const byBar = new Map<number, Signal[]>()
  for (const s of signals) byBar.set(s.index, [...(byBar.get(s.index) ?? []), s])
  const closePos = (time: number, price: number, exitReason: Trade['exitReason'], open = false) => {
    if (!pos) return
    const raw = pos.direction === 'long' ? price / pos.entryPrice - 1 : pos.entryPrice / price - 1
    trades.push({ ...pos, exitTime: time, exitPrice: price, exitReason, pnlPct: round(raw * 100 - 2 * feePct), ...(open ? { open } : {}) })
    pos = null
    exitOrder = null
  }
  for (let i = 1; i < candles.length; i++) {
    const bar = candles[i]
    for (const s of byBar.get(i - 1) ?? []) {
      if (s.action === 'close_all' || (s.action === 'close' && pos?.id === s.id)) closePos(bar.time, bar.open, 'signal')
      else if (s.action === 'entry' && s.direction) {
        if (pos && pos.direction === s.direction) continue
        closePos(bar.time, bar.open, 'signal')
        pos = { id: s.id, direction: s.direction, entryTime: bar.time, entryPrice: bar.open }
      } else if (s.action === 'exit' && pos && (s.fromEntry === undefined || s.fromEntry === pos.id)) {
        exitOrder = { fromEntry: s.fromEntry, stop: s.stop, limit: s.limit }
      }
    }
    const p = pos as typeof pos
    if (p && exitOrder) {
      const long = p.direction === 'long'
      const { stop, limit } = exitOrder
      if (stop !== undefined && (long ? bar.low <= stop : bar.high >= stop)) {
        closePos(bar.time, long ? Math.min(bar.open, stop) : Math.max(bar.open, stop), 'stop')
      } else if (limit !== undefined && (long ? bar.high >= limit : bar.low <= limit)) {
        closePos(bar.time, long ? Math.max(bar.open, limit) : Math.min(bar.open, limit), 'limit')
      }
    }
  }
  const last = candles[candles.length - 1]
  if (last) closePos(last.time, last.close, 'end', true)
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
