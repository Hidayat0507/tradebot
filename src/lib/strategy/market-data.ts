import type { Candle } from './types'
import { LIMITS } from './types'

export interface PublicOhlcvSource {
  fetchOHLCV(symbol: string, timeframe?: string, since?: number, limit?: number): Promise<(number | undefined)[][]>
}

/** Public market data only: the exchange is constructed without credentials. */
export async function createPublicExchange(exchangeId: string): Promise<PublicOhlcvSource> {
  const ccxt = (await import('ccxt')).default as unknown as Record<string, new (o: object) => PublicOhlcvSource>
  if (!/^[a-z0-9]+$/.test(exchangeId) || typeof ccxt[exchangeId] !== 'function') throw new Error('unknown exchange')
  return new ccxt[exchangeId]({ enableRateLimit: true })
}

export async function fetchPublicCandles(src: PublicOhlcvSource, symbol: string, timeframe = '1h', limit = 500): Promise<Candle[]> {
  const rows = await src.fetchOHLCV(symbol, timeframe, undefined, Math.min(limit, LIMITS.maxCandles))
  return rows
    .filter((r) => r.length >= 6 && r.every((v) => typeof v === 'number'))
    .map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }) as Candle)
}
