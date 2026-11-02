import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database/schema'
import { z } from 'zod'
import { convertPine, type AiConverter } from './converter'
import { getAiConverter } from './ai-converter'
import { TIMEFRAMES } from './exchanges'
import { LIMITS } from './types'

export const saveStrategySchema = z.object({
  pine: z.string().min(1).max(LIMITS.maxSourceBytes),
  timeframe: z.enum(TIMEFRAMES).default('1h'),
  paperQuoteSize: z.number().positive().max(1_000_000).default(100),
  /** Saving never enables implicitly: omitted → false. */
  enabled: z.boolean().default(false),
  allow_testnet: z.boolean().default(false),
  max_orders_per_day: z.number().int().min(1).max(50).default(5),
  reviewed_rules: z.boolean().default(false),
})

export type SaveStrategyResult =
  | { ok: true; strategy: Record<string, unknown> }
  | { ok: false; status: number; error: string }

const COLUMNS = 'bot_id, name, pine_source, definition, converter, timeframe, paper_quote_size, enabled, mode, last_candle_time, updated_at, allow_testnet, max_orders_per_day, kill_switch_tripped_at'

/**
 * Converts Pine server-side (the client's definition is never trusted) and saves it for a bot.
 * Uses the caller's user-scoped client so RLS + column grants apply. Testnet requires an explicit reviewed opt-in.
 */
export async function saveBotStrategy(supabase: SupabaseClient<Database>, userId: string, botId: string, input: unknown, ai: AiConverter = getAiConverter()): Promise<SaveStrategyResult> {
  const parsed = saveStrategySchema.safeParse(input)
  if (!parsed.success) return { ok: false, status: 400, error: 'Invalid request' }
  const body = parsed.data
  if (body.allow_testnet) {
    const { data: bot, error } = await supabase.from('bots').select('mode').eq('id', botId).eq('user_id', userId).single()
    if (error || bot?.mode !== 'testnet') return { ok: false, status: 400, error: 'Testnet opt-in requires a testnet bot' }
    if (!body.reviewed_rules) return { ok: false, status: 400, error: 'Review the converted rules before opting into testnet' }
  }
  const conv = await convertPine(body.pine, ai)
  if (!conv.ok) return { ok: false, status: 422, error: conv.error }
  const fields = {
    name: conv.definition.name,
    pine_source: body.pine,
    // Conversion validates the closed JSON AST; its interfaces lack a JSON index signature.
    definition: conv.definition as unknown as Json,
    converter: conv.via,
    timeframe: body.timeframe,
    paper_quote_size: body.paperQuoteSize,
    enabled: body.enabled,
    allow_testnet: body.allow_testnet,
    max_orders_per_day: body.max_orders_per_day,
  }
  const { data: existing, error: selErr } = await supabase
    .from('bot_strategies').select('bot_id').eq('bot_id', botId).maybeSingle()
  if (selErr) return { ok: false, status: 500, error: 'Failed to load strategy' }
  const table = supabase.from('bot_strategies')
  const { data, error } = existing
    ? await table.update(fields).eq('bot_id', botId).select(COLUMNS).single()
    : await table.insert({ ...fields, bot_id: botId, user_id: userId }).select(COLUMNS).single()
  if (error || !data) return { ok: false, status: 500, error: 'Failed to save strategy' }
  return { ok: true, strategy: data }
}

export async function getBotStrategy(supabase: SupabaseClient<Database>, botId: string) {
  const { data, error } = await supabase.from('bot_strategies').select(COLUMNS).eq('bot_id', botId).maybeSingle()
  if (error) throw new Error('Failed to load strategy')
  return data
}

export async function deleteBotStrategy(supabase: SupabaseClient<Database>, botId: string) {
  const { error } = await supabase.from('bot_strategies').delete().eq('bot_id', botId)
  if (error) throw new Error('Failed to delete strategy')
}
