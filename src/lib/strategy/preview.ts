import { z } from 'zod'
import { backtest } from './backtest'
import { convertPine, type AiConverter } from './converter'
import { createPublicExchange, fetchPublicCandles, type PublicOhlcvSource } from './market-data'
import { sampleCandles } from './sample-candles'
import { LIMITS, type Candle } from './types'
import { PUBLIC_EXCHANGES, TIMEFRAMES } from './exchanges'

const candleSchema = z.object({
  time: z.number(), open: z.number(), high: z.number(), low: z.number(), close: z.number(), volume: z.number(),
})

export const previewSchema = z.object({
  pine: z.string().min(1).max(LIMITS.maxSourceBytes),
  candles: z.union([
    z.literal('sample'),
    z.array(candleSchema).min(2).max(LIMITS.maxCandles),
    z.object({
      exchange: z.enum(PUBLIC_EXCHANGES),
      symbol: z.string().regex(/^[A-Z0-9]+\/[A-Z0-9]+(:[A-Z0-9]+)?$/).max(30),
      timeframe: z.enum(TIMEFRAMES).default('1h'),
      limit: z.number().int().min(50).max(1000).default(500),
    }),
  ]).default('sample'),
})

export type PreviewInput = z.input<typeof previewSchema>

export interface PreviewDeps {
  ai?: AiConverter
  publicExchange?: (id: string) => Promise<PublicOhlcvSource>
}

/** Convert + backtest. Paper only: never places orders, never touches DB or private APIs. */
export async function runPreview(input: unknown, deps: PreviewDeps = {}) {
  const body = previewSchema.parse(input)
  const conv = await convertPine(body.pine, deps.ai)
  if (!conv.ok) return { ok: false as const, error: conv.error }
  let candles: Candle[]
  let source: string
  if (body.candles === 'sample') {
    candles = sampleCandles(300); source = 'sample'
  } else if (Array.isArray(body.candles)) {
    candles = body.candles; source = 'provided'
  } else {
    const c = body.candles
    const ex = await (deps.publicExchange ?? createPublicExchange)(c.exchange)
    candles = await fetchPublicCandles(ex, c.symbol, c.timeframe, c.limit)
    source = `${c.exchange}:${c.symbol}:${c.timeframe} (public)`
  }
  const result = backtest(conv.definition, candles)
  return {
    ok: true as const,
    via: conv.via,
    warnings: conv.warnings,
    definition: conv.definition,
    candleSource: source,
    candleCount: candles.length,
    candles: candles.map((c) => ({ time: c.time, close: c.close })),
    ...result,
  }
}
