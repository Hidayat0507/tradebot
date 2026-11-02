import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database/schema'
import { logger } from '@/lib/logging'
import { createPublicExchange, fetchPublicCandles, type PublicOhlcvSource } from './market-data'
import { schedulerOrderPath, type ScheduledStrategy, type SchedulerDeps } from './paper-scheduler'
import { PUBLIC_EXCHANGES } from './exchanges'
import { validateDefinition } from './validate'


/**
 * Supabase-backed scheduler deps (service-role client, server only).
 * Credentials are loaded only at the final boundary for opted-in testnet bots.
 */
export function createSupabaseSchedulerDeps(
  supabase: SupabaseClient<Database>,
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
        .select('bot_id, definition, timeframe, paper_quote_size, last_candle_time, allow_testnet, max_orders_per_day, kill_switch_tripped_at, bots!inner(id, user_id, name, exchange, pair, enabled, mode)')
        .eq('enabled', true)
        .eq('mode', 'paper')
        .limit(opts.maxStrategies ?? 100)
      if (error) throw new Error('failed to load strategies')
      const out: ScheduledStrategy[] = []
      for (const r of data ?? []) {
        const b = r.bots
        if (!b || !b.enabled || (b.mode !== 'paper' && b.mode !== 'testnet')) continue
        const exchange = b.exchange.toLowerCase()
        if (!(PUBLIC_EXCHANGES as readonly string[]).includes(exchange) && !(exchange === 'hyperliquid' && b.mode === 'testnet')) {
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
          bot: { id: b.id, user_id: b.user_id, name: b.name, exchange, pair: b.pair, api_key: '', api_secret: '', webhook_secret: '', mode: b.mode },
          allowTestnet: r.allow_testnet, maxOrdersPerDay: r.max_orders_per_day, killSwitchTrippedAt: r.kill_switch_tripped_at,
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
      const { data, error } = await supabase.rpc('claim_strategy_order', { p_bot_id: botId, p_alert_id: alertId, p_ts: ts })
      if (error) throw new Error('failed to reserve strategy order')
      return data === 'claimed'
    },
    async executeOrder(alert, bot) {
      // Re-read current mode immediately before execution, never load credentials for live bots.
      const { data: current, error } = await supabase.from('bots')
        .select('id, mode, enabled').eq('id', bot.id).single()
      if (error || !current?.enabled || (current.mode !== 'paper' && current.mode !== 'testnet')) {
        throw new Error('bot is no longer eligible for scheduler orders')
      }
      let executionBot = bot
      if (bot.mode === 'testnet') {
        if (current.mode !== 'testnet') throw new Error('bot is no longer testnet')
        const { data: credentials, error: credError } = await supabase.from('bots')
          .select('api_key, api_secret, password, max_position_size')
          .eq('id', bot.id).eq('mode', 'testnet').single()
        if (credError || !credentials) throw new Error('testnet credentials unavailable')
        executionBot = { ...bot, ...credentials, mode: 'testnet' }
      }
      const trade = await schedulerOrderPath(supabase)(alert, executionBot)
      // Existing order path records realized closes with pnl. Only a NEW losing close
      // can trip this guard, so owner clearing does not immediately re-trip on old losses.
      const pnl = (trade as { pnl?: number | null } | null)?.pnl
      if (pnl != null && Number(pnl) < 0) {
        const { data: closes, error: lossError } = await supabase.from('trades').select('pnl')
          .eq('bot_id', bot.id).not('pnl', 'is', null).order('created_at', { ascending: false }).limit(3)
        if (lossError) throw new Error('failed to check strategy losses')
        if (closes?.length === 3 && closes.every(t => Number(t.pnl) < 0)) {
          const { error: tripError } = await supabase.from('bot_strategies')
            .update({ kill_switch_tripped_at: new Date((opts.now ?? Date.now)()).toISOString(), last_signal: 'stopped — 3 losing closes in a row' }).eq('bot_id', bot.id)
          if (tripError) throw new Error('failed to trip strategy kill switch')
        }
      }
      return trade
    },
    async saveCursor(botId, lastCandleTime, lastSignal) {
      const { error } = await supabase
        .from('bot_strategies')
        .update({
          last_candle_time: new Date(lastCandleTime).toISOString(),
        })
        .eq('bot_id', botId)
      if (error) throw new Error('failed to save cursor')
      if (lastSignal) {
        const { error: signalError } = await supabase.from('bot_strategies')
          .update({ last_signal_at: new Date(lastSignal.time).toISOString(), last_signal: lastSignal.summary.slice(0, 100) })
          .eq('bot_id', botId).is('kill_switch_tripped_at', null)
        if (signalError) throw new Error('failed to save last signal')
      }
    },
    now: opts.now ?? Date.now,
  }
}
