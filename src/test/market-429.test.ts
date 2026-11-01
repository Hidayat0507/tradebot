import { describe, expect, it, vi } from 'vitest'
import * as ccxt from 'ccxt'
import { createLimiter } from '@/lib/concurrency'

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
    const limit = createLimiter(1)
    const r = await Promise.allSettled([1, 2, 3].map(n => limit(async () => { if (n === 2) throw new Error('x'); return n })))
    expect(r.map((x) => x.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
  })
})

describe('/api/exchange/market initialization throttling', () => {
  it.each([ccxt.DDoSProtection, ccxt.RateLimitExceeded])('returns 429 through the real middleware (%s)', async ErrorType => {
    const { getExchangePlugin } = await import('@/lib/exchanges/registry')
    const create = vi.spyOn(getExchangePlugin('bitget'), 'createClient')
      .mockRejectedValueOnce(new ErrorType('throttled'))
    try {
      const { POST } = await import('@/app/api/exchange/market/route')
      const { NextRequest } = await import('next/server')
      const response = await POST(new NextRequest('http://localhost/api/exchange/market', {
        method: 'POST', body: JSON.stringify({ exchange: 'bitget', symbol: 'BTC/USDT' }),
      }))
      expect(response.status).toBe(429)
    } finally {
      create.mockRestore()
    }
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
