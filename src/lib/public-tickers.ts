import * as ccxt from 'ccxt'
import { ApiError } from '@/app/api/_middleware/api-handler'
import { createExchangeClient } from '@/app/api/_middleware/exchange-middleware'
import type { ExchangeClient, TickerResult } from '@/types/exchange'

export const MAX_TICKER_SYMBOLS = 24

type TickerClient = Pick<ExchangeClient, 'fetchTicker' | 'has'> & {
  fetchTickers?: (symbols: string[]) => Promise<Record<string, TickerResult>>
}

export function validateTickerRequest(exchange: unknown, symbols: unknown): { exchange: string; symbols: string[] } {
  if (typeof exchange !== 'string' || !['bitget', 'hyperliquid'].includes(exchange.toLowerCase())) {
    throw new ApiError('Unsupported ticker exchange', 400)
  }
  if (!Array.isArray(symbols) || symbols.length === 0 || symbols.length > MAX_TICKER_SYMBOLS ||
    symbols.some(symbol => typeof symbol !== 'string' || !symbol.trim() || symbol.length > 100)) {
    throw new ApiError(`symbols must contain 1 to ${MAX_TICKER_SYMBOLS} nonempty symbol strings`, 400)
  }
  return { exchange: exchange.toLowerCase(), symbols: [...new Set(symbols.map(symbol => symbol.trim()))] }
}

/** Public ticker data only. No credentials, order books, candles, or private API calls. */
export function createPublicTickerService(
  createClient: (exchange: string) => Promise<TickerClient>,
  now = Date.now,
) {
  const clients = new Map<string, Promise<TickerClient>>()
  const cache = new Map<string, { at: number; value: Record<string, TickerResult> }>()
  const inflight = new Map<string, Promise<Record<string, TickerResult>>>()

  async function get(exchange: string, symbols: string[]) {
    const request = validateTickerRequest(exchange, symbols)
    const sorted = [...request.symbols].sort()
    const key = JSON.stringify([request.exchange, sorted])
    const hit = cache.get(key)
    if (hit && now() - hit.at < 20_000) return rows(request.exchange, request.symbols, hit.value)
    let pending = inflight.get(key)
    if (!pending) {
      pending = (async () => {
        let clientPromise = clients.get(request.exchange)
        if (!clientPromise) {
          clientPromise = Promise.resolve().then(() => createClient(request.exchange))
          clients.set(request.exchange, clientPromise)
          clientPromise.catch(() => clients.delete(request.exchange))
        }
        const client = await clientPromise
        let tickers: Record<string, TickerResult>
        if (client.has?.fetchTickers === true && client.fetchTickers) {
          tickers = await client.fetchTickers(sorted)
        } else {
          // Adapters without a native batch endpoint get at most two concurrent calls.
          tickers = {}
          let cursor = 0
          await Promise.all(Array.from({ length: Math.min(2, sorted.length) }, async () => {
            while (cursor < sorted.length) {
              const symbol = sorted[cursor++]
              try { tickers[symbol] = await client.fetchTicker(symbol) }
              catch (error) { if (!(error instanceof ccxt.BadSymbol)) throw error }
            }
          }))
        }
        // Bound memory even when unauthenticated callers request different symbol sets.
        if (cache.size >= 100) cache.delete(cache.keys().next().value!)
        cache.set(key, { at: now(), value: tickers })
        return tickers
      })().catch(error => {
        if (error instanceof ccxt.RateLimitExceeded || error instanceof ccxt.DDoSProtection) {
          throw new ApiError('Exchange rate limit hit, try again shortly', 429)
        }
        if (error instanceof ccxt.BadSymbol) throw new ApiError('Unsupported ticker symbol', 400)
        throw error
      }).finally(() => inflight.delete(key))
      inflight.set(key, pending)
    }
    return rows(request.exchange, request.symbols, await pending)
  }
  return { get }
}

function rows(exchange: string, symbols: string[], tickers: Record<string, TickerResult>) {
  return symbols.map(symbol => {
    const ticker = tickers[symbol]
    if (!ticker) return { exchange, symbol, error: true, message: 'Ticker unavailable' }
    return {
      exchange, symbol, last_price: ticker.last, bid: ticker.bid, ask: ticker.ask,
      volume_24h: ticker.baseVolume ?? ticker.quoteVolume, change_24h: ticker.percentage,
      high_24h: ticker.high, low_24h: ticker.low,
    }
  })
}

export const publicTickers = createPublicTickerService(
  exchange => createExchangeClient(exchange, undefined, 'market_data'),
)
