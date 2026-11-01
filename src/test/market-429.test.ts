import { describe, expect, it, vi } from 'vitest'
import * as ccxt from 'ccxt'
import { createLimiter, mapSettledLimit } from '@/lib/concurrency'
import { createMarketDataService } from '@/lib/market-data-service'
import { ApiError } from '@/app/api/_middleware/api-handler'

const tick = () => new Promise((r) => setTimeout(r, 1))

describe('createLimiter', () => {
  it('never exceeds max and keeps order', async () => {
    const limit = createLimiter(2)
    let active = 0, peak = 0
    const order: number[] = []
    await Promise.all([1, 2, 3, 4, 5].map((n) => limit(async () => {
      active++; peak = Math.max(peak, active); await tick(); order.push(n); active--
    })))
    expect(peak).toBe(2)
    expect(order).toEqual([1, 2, 3, 4, 5])
  })
  it('a failing task frees its slot', async () => {
    const r = await mapSettledLimit([1, 2, 3], 1, async (n) => { if (n === 2) throw new Error('x'); return n })
    expect(r.map((x) => x.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
  })
})

function setup(fetchImpl: (symbol: string) => Promise<Record<string, unknown>>) {
  let t = 1_000
  const createClient = vi.fn(async () => ({ id: 'bitget' }))
  const fetch = vi.fn(async (_c: unknown, s: string) => fetchImpl(s))
  const svc = createMarketDataService({ createClient, fetch, ttlMs: 30_000, staleTtlMs: 300_000, maxConcurrent: 2, now: () => t })
  return { svc, createClient, fetch, advance: (ms: number) => { t += ms } }
}

describe('market data service', () => {
  it('shares one client, caps upstream concurrency, dedupes and caches', async () => {
    let active = 0, peak = 0
    const { svc, createClient, fetch } = setup(async (s) => { active++; peak = Math.max(peak, active); await tick(); active--; return { symbol: s } })
    const syms = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT']
    await Promise.all([...syms, ...syms].map((s) => svc.get('bitget', s)))
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(6) // duplicates deduped in flight
    expect(peak).toBeLessThanOrEqual(2)
    expect(await svc.get('bitget', 'BTC/USDT')).toMatchObject({ symbol: 'BTC/USDT', cached: true })
    expect(fetch).toHaveBeenCalledTimes(6)
  })
  it('refetches after TTL; on 429 serves stale, then 429 ApiError when nothing cached', async () => {
    let fail = false
    const { svc, fetch, advance } = setup(async (s) => { if (fail) throw new ccxt.RateLimitExceeded('bitget 429 Too Many Requests'); return { symbol: s, last_price: 1 } })
    await svc.get('bitget', 'BTC/USDT')
    advance(31_000); fail = true
    expect(await svc.get('bitget', 'BTC/USDT')).toMatchObject({ last_price: 1, stale: true })
    expect(fetch).toHaveBeenCalledTimes(2)
    const err = await svc.get('bitget', 'ETH/USDT').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.statusCode).toBe(429)
    advance(400_000)
    expect((await svc.get('bitget', 'BTC/USDT').catch((e) => e)).statusCode).toBe(429)
  })
  it('non-rate-limit errors pass through and are not cached', async () => {
    const { svc, fetch } = setup(async () => { throw new Error('boom') })
    await expect(svc.get('bitget', 'X/USDT')).rejects.toThrow('boom')
    await expect(svc.get('bitget', 'X/USDT')).rejects.toThrow('boom')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('/api/exchange/market POST maps Bitget 429 (DDoSProtection during loadMarkets) to 429, not 500', () => {
  it('returns 429', async () => {
    vi.resetModules()
    vi.doMock('@/app/api/_middleware/exchange-middleware', () => ({
      createExchangeClient: async () => ({ id: 'bitget' }),
      fetchMarketData: async () => { throw new ccxt.DDoSProtection('bitget {"code":"429","msg":"Too Many Requests"}') },
    }))
    const { POST } = await import('@/app/api/exchange/market/route')
    const { NextRequest } = await import('next/server')
    const res = await POST(new NextRequest('http://localhost/api/exchange/market', { method: 'POST', body: JSON.stringify({ exchange: 'bitget', symbol: 'BTC/USDT' }) }))
    expect(res.status).toBe(429)
    vi.doUnmock('@/app/api/_middleware/exchange-middleware')
  })
})


describe('real public market fetch error mapping', () => {
  it.each([ccxt.DDoSProtection, ccxt.RateLimitExceeded])('preserves 429 through middleware (%s)', async (ErrorType) => {
    const { fetchMarketData } = await import('@/app/api/_middleware/exchange-middleware')
    const client = { id: 'bitget', fetchTicker: vi.fn().mockRejectedValue(new ErrorType('throttled')) }
    await expect(fetchMarketData(client as never, 'UNIQUE/USDT')).rejects.toMatchObject({ statusCode: 429 })
  })
  it('reports active and pending limiter slots while work is queued', async () => {
    const limit = createLimiter(1)
    let release!: () => void
    const first = limit(() => new Promise<void>(resolve => { release = resolve }))
    const second = limit(async () => undefined)
    await Promise.resolve()
    expect(limit.active).toBe(1)
    expect(limit.pending).toBe(1)
    release()
    await Promise.all([first, second])
  })
})
