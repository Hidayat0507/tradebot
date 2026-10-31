import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logging'
import { createPublicExchange, fetchPublicCandles, type PublicOhlcvSource } from './market-data'
import { paperOrderPath, type ScheduledStrategy, type SchedulerDeps } from './paper-scheduler'
import { PUBLIC_EXCHANGES } from './exchanges'
import { validateDefinition } from './validate'

type Row = {
  bot_id: string
  definition: unknown
  timeframe: string
  paper_quote_size: number | string
  last_candle_time: string | null
  bots: { id: string; user_id: string; name: string; exchange: string; pair: string; enabled: boolean } | null
}

/**
 * Supabase-backed scheduler deps (service-role client, server only).
 * Never selects bot credentials: the paper path does not need them.
 */
export function createSupabaseSchedulerDeps(
  supabase: SupabaseClient,
  opts: { now?: () => number; publicExchange?: (id: string) => Promise<PublicOhlcvSource>; maxStrategies?: number } = {},
): SchedulerDeps {
  const exchanges = new Map<string, Promise<PublicOhlcvSource>>()
  const getExchange = (id: string) => {
    if (!exchanges.has(id)) exchanges.set(id, (opts.publicExchange ?? createPublicExchange)(id))
    return exchanges.get(id)!
  }
  return {
    async loadEnabled() {
      const { data, error } = await supabase
        .from('bot_strategies')
        .select('bot_id, definition, timeframe, paper_quote_size, last_candle_time, bots!inner(id, user_id, name, exchange, pair, enabled)')
        .eq('enabled', true)
        .eq('mode', 'paper')
        .limit(opts.maxStrategies ?? 100)
      if (error) throw new Error('failed to load strategies')
      const out: ScheduledStrategy[] = []
      for (const r of (data ?? []) as unknown as Row[]) {
        const b = r.bots
        if (!b || !b.enabled) continue
        const exchange = b.exchange.toLowerCase()
        if (!(PUBLIC_EXCHANGES as readonly string[]).includes(exchange)) {
          logger.warn('Skipping strategy: exchange not in public allowlist', { botId: b.id })
          continue
        }
        let definition
        try {
          // Rows are user-writable: always re-validate.
          definition = validateDefinition(r.definition)
        } catch {
          logger.warn('Skipping strategy: invalid definition', { botId: b.id })
          continue
        }
        out.push({
          bot: { id: b.id, user_id: b.user_id, name: b.name, exchange, pair: b.pair, api_key: '', api_secret: '', webhook_secret: '', mode: 'paper' },
          definition,
          timeframe: r.timeframe,
          paperQuoteSize: Number(r.paper_quote_size),
          lastCandleTime: r.last_candle_time ? Date.parse(r.last_candle_time) : null,
        })
      }
      return out
    },
    async fetchCandles(exchange, symbol, timeframe, limit) {
      return fetchPublicCandles(await getExchange(exchange), symbol, timeframe, limit)
    },
    async claimSignal(botId, alertId, ts) {
      const { error } = await supabase.from('signals').insert({ bot_id: botId, alert_id: alertId, ts })
      if (error?.code === '23505') return false
      if (error) throw new Error('failed to record signal')
      return true
    },
    executeOrder: paperOrderPath(supabase),
    async saveCursor(botId, lastCandleTime) {
      const { error } = await supabase
        .from('bot_strategies')
        .update({ last_candle_time: new Date(lastCandleTime).toISOString() })
        .eq('bot_id', botId)
      if (error) throw new Error('failed to save cursor')
    },
    now: opts.now ?? Date.now,
  }
}
