import type { TradingViewSignal } from '@/types'
import type { BotData } from '@/app/api/_middleware/webhook/execute-trade'
import { evaluate } from './runtime'
import type { Candle, Signal, StrategyDefinition } from './types'

export const TIMEFRAME_MS: Record<string, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
}

export interface ScheduledStrategy {
  bot: BotData & { pair: string }
  definition: StrategyDefinition
  timeframe: string
  paperQuoteSize: number
  /** open time (ms) of the last closed candle already processed; null = never run */
  lastCandleTime: number | null
}

export interface SchedulerDeps {
  loadEnabled(): Promise<ScheduledStrategy[]>
  /** public market data only */
  fetchCandles(exchange: string, symbol: string, timeframe: string, limit: number): Promise<Candle[]>
  /** durable idempotency claim (signals table); false if already claimed */
  claimSignal(botId: string, alertId: string, tsIso: string): Promise<boolean>
  /** existing order path; always called with a paper-mode bot */
  executeOrder(alert: TradingViewSignal, bot: BotData): Promise<unknown>
  saveCursor(botId: string, lastCandleTime: number): Promise<void>
  now(): number
}

export interface OrderIntent {
  index: number
  time: number
  side: 'buy' | 'sell'
  reason: string
  price: number
}

/**
 * Replays signals (and, when candles are given, strategy.exit stop/limit levels) through a
 * single-position state machine and returns market order intents. Deterministic from history,
 * so the current position is reconstructed on every tick.
 *
 * Bar order per candle i: (1) a pending exit order (placed at an earlier bar's close) is checked
 * against bar i's high/low — stop first, gaps fill at open; (2) bar i's close signals are applied.
 * A stop/limit hit is therefore reported on the tick after bar i closes, at the stop/limit price.
 */
export function signalsToIntents(signals: Signal[], candles?: Candle[]): OrderIntent[] {
  type Pos = { id: string; dir: 'long' | 'short' }
  let pos = null as Pos | null
  let exitOrder = null as { stop?: number; limit?: number } | null
  const cur = (): Pos | null => pos
  const out: OrderIntent[] = []
  const flat = (index: number, time: number, price: number, reason: string) => {
    const p = cur()
    if (!p) return
    out.push({ index, time, side: p.dir === 'long' ? 'sell' : 'buy', reason, price })
    pos = null
    exitOrder = null
  }
  const byBar = new Map<number, Signal[]>()
  for (const s of signals) byBar.set(s.index, [...(byBar.get(s.index) ?? []), s])
  const bars = candles ? candles.length : signals.reduce((m, s) => Math.max(m, s.index + 1), 0)
  for (let i = 0; i < bars; i++) {
    const p = cur()
    const bar = candles?.[i]
    if (bar && p && exitOrder) {
      const long = p.dir === 'long'
      const { stop, limit } = exitOrder as { stop?: number; limit?: number }
      if (stop !== undefined && (long ? bar.low <= stop : bar.high >= stop)) {
        flat(i, bar.time, long ? Math.min(bar.open, stop) : Math.max(bar.open, stop), `stop:${p.id}`)
      } else if (limit !== undefined && (long ? bar.high >= limit : bar.low <= limit)) {
        flat(i, bar.time, long ? Math.max(bar.open, limit) : Math.min(bar.open, limit), `limit:${p.id}`)
      }
    }
    for (const s of byBar.get(i) ?? []) {
      if (s.action === 'close_all') flat(s.index, s.time, s.price, 'close_all')
      else if (s.action === 'close' && cur()?.id === s.id) flat(s.index, s.time, s.price, `close:${s.id}`)
      else if (s.action === 'entry' && s.direction) {
        if (cur()?.dir === s.direction) continue
        flat(s.index, s.time, s.price, `reverse:${s.id}`)
        out.push({ index: s.index, time: s.time, side: s.direction === 'long' ? 'buy' : 'sell', reason: `entry:${s.id}`, price: s.price })
        pos = { id: s.id, dir: s.direction }
      } else if (s.action === 'exit' && cur() && (s.fromEntry === undefined || s.fromEntry === cur()!.id)) {
        exitOrder = { stop: s.stop, limit: s.limit }
      }
    }
  }
  return out
}

export interface TickResult {
  botId: string
  status: 'ok' | 'skipped' | 'error'
  orders: number
  detail?: string
}

/** One scheduler tick: evaluate closed candles for each enabled strategy and send paper orders. */
export async function runPaperTick(deps: SchedulerDeps, candleLimit = 500): Promise<TickResult[]> {
  const results: TickResult[] = []
  for (const s of await deps.loadEnabled()) {
    const botId = s.bot.id
    try {
      const tf = TIMEFRAME_MS[s.timeframe]
      if (!tf) { results.push({ botId, status: 'skipped', orders: 0, detail: 'bad timeframe' }); continue }
      const now = deps.now()
      const closed = (await deps.fetchCandles(s.bot.exchange, s.bot.pair, s.timeframe, candleLimit))
        .filter((c) => c.time + tf <= now)
        .sort((a, b) => a.time - b.time)
      if (closed.length < 2) { results.push({ botId, status: 'skipped', orders: 0, detail: 'not enough candles' }); continue }
      const lastClosed = closed[closed.length - 1].time
      if (s.lastCandleTime !== null && lastClosed <= s.lastCandleTime) {
        results.push({ botId, status: 'skipped', orders: 0, detail: 'no new closed candle' }); continue
      }
      // First run only acts on the latest closed bar: never replay history into orders.
      const cursor = s.lastCandleTime ?? closed[closed.length - 2].time
      const intents = signalsToIntents(evaluate(s.definition, closed), closed).filter((i) => i.time > cursor)
      const paperBot: BotData = { ...s.bot, mode: 'paper' }
      let orders = 0
      for (const [seq, intent] of intents.entries()) {
        const alertId = `pine:${botId}:${intent.time}:${seq}:${intent.side}`
        const ts = new Date(intent.time + tf).toISOString()
        if (!(await deps.claimSignal(botId, alertId, ts))) continue
        await deps.executeOrder({
          bot_id: botId, symbol: s.bot.pair, action: intent.side, price: intent.price,
          amount: s.paperQuoteSize / intent.price, alert_id: alertId, ts, strategy: s.definition.name,
        }, paperBot)
        orders++
      }
      await deps.saveCursor(botId, lastClosed)
      results.push({ botId, status: 'ok', orders })
    } catch (e) {
      results.push({ botId, status: 'error', orders: 0, detail: (e as Error).message })
    }
  }
  return results
}

/**
 * Default executeOrder: the existing webhook order path (processWebhookAlert → executeTrade → saveTrade),
 * hard-guarded to paper mode. Imported lazily so this module has no Supabase/env side effects.
 */
export function paperOrderPath(supabase: unknown): SchedulerDeps['executeOrder'] {
  return async (alert, bot) => {
    if (bot.mode !== 'paper') throw new Error('in-app strategies are paper only')
    const { processWebhookAlert } = await import('@/app/api/_middleware/webhook/process-webhook')
    return processWebhookAlert(alert, bot, supabase as Parameters<typeof processWebhookAlert>[2])
  }
}
