import * as ccxt from 'ccxt'
import { createLimiter } from '@/lib/concurrency'
import { ApiError } from '@/app/api/_middleware/api-handler'

/**
 * Public (no-credential) market data with:
 * - one shared ccxt client per exchange, so ccxt's rate limiter and loadMarkets() are shared
 *   (previously every request built a new client → no throttling across requests + repeated loadMarkets),
 * - a result cache (fresh TTL) with in-flight de-duplication,
 * - a global concurrency cap for upstream calls,
 * - stale-on-429: on rate limit we serve the last good value (up to staleTtl) instead of a 500.
 */
export interface MarketDataServiceOptions<C> {
  createClient: (exchange: string) => Promise<C>
  fetch: (client: C, symbol: string) => Promise<Record<string, unknown>>
  ttlMs?: number
  staleTtlMs?: number
  maxConcurrent?: number
  now?: () => number
}

type Entry = { value: Record<string, unknown>; at: number }

export const isRateLimitError = (e: unknown) =>
  e instanceof ccxt.RateLimitExceeded || e instanceof ccxt.DDoSProtection ||
  (e instanceof ApiError && e.statusCode === 429) ||
  (e instanceof Error && /\b429\b|too many requests|rate limit/i.test(e.message))

export function createMarketDataService<C>(opts: MarketDataServiceOptions<C>) {
  const ttl = opts.ttlMs ?? 30_000
  const staleTtl = opts.staleTtlMs ?? 5 * 60_000
  const now = opts.now ?? Date.now
  const limit = createLimiter(opts.maxConcurrent ?? 2)
  const clients = new Map<string, Promise<C>>()
  const cache = new Map<string, Entry>()
  const inflight = new Map<string, Promise<Record<string, unknown>>>()

  const clientFor = (exchange: string) => {
    let c = clients.get(exchange)
    if (!c) {
      c = opts.createClient(exchange)
      c.catch(() => clients.delete(exchange))
      clients.set(exchange, c)
    }
    return c
  }

  async function get(exchange: string, symbol: string): Promise<Record<string, unknown> & { cached?: boolean; stale?: boolean }> {
    const key = `${exchange.toLowerCase()}:${symbol}`
    const hit = cache.get(key)
    if (hit && now() - hit.at < ttl) return { ...hit.value, cached: true }
    const running = inflight.get(key)
    if (running) return running
    const p = (async () => {
      try {
        const client = await clientFor(exchange.toLowerCase())
        const value = await limit(() => opts.fetch(client, symbol))
        cache.set(key, { value, at: now() })
        return value
      } catch (e) {
        if (isRateLimitError(e)) {
          const old = cache.get(key)
          if (old && now() - old.at < staleTtl) return { ...old.value, cached: true, stale: true }
          throw new ApiError('Exchange rate limit hit, try again shortly', 429)
        }
        throw e
      } finally {
        inflight.delete(key)
      }
    })()
    inflight.set(key, p)
    return p
  }

  return { get, _stats: () => ({ cache: cache.size, inflight: inflight.size, active: limit.active, pending: limit.pending, clients: clients.size }) }
}
