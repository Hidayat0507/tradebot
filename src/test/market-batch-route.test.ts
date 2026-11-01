import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/app/api/_middleware/api-handler'
const mocks = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), detail: vi.fn() }))
vi.mock('@/lib/public-tickers', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/public-tickers')>(), publicTickers: { get: mocks.get },
}))
vi.mock('@/app/api/_middleware/exchange-middleware', () => ({ createExchangeClient: mocks.create, fetchMarketData: mocks.detail }))
import { POST } from '@/app/api/exchange/market/route'
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/exchange/market', { method: 'POST', body: JSON.stringify(body) }))
beforeEach(() => { vi.clearAllMocks() })
describe('market batch endpoint', () => {
  it('routes a symbol list to the batch service', async () => {
    mocks.get.mockResolvedValue([{ symbol: 'BTC/USDT', last_price: 100 }])
    const response = await post({ exchange: 'BITGET', symbols: ['BTC/USDT', 'BTC/USDT'] })
    expect(response.status).toBe(200)
    expect((await response.json()).data).toHaveLength(1)
    expect(mocks.get).toHaveBeenCalledWith('bitget', ['BTC/USDT'])
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.detail).not.toHaveBeenCalled()
  })
  it.each([null, {}, { exchange: 'bitget', symbols: [] }, { exchange: 'bitget', symbols: 'BTC/USDT' }, { exchange: 'other', symbols: ['BTC/USDT'] }])('rejects invalid batch payloads', async body => {
    expect((await post(body)).status).toBe(400)
    expect(mocks.get).not.toHaveBeenCalled()
  })
  it.each(['initialization', 'detail'])('preserves 429 during single-symbol %s', async stage => {
    mocks.create.mockResolvedValue({ id: 'bitget' })
    mocks.detail.mockResolvedValue({ symbol: 'BTC/USDT' })
    const failing = stage === 'initialization' ? mocks.create : mocks.detail
    failing.mockRejectedValueOnce(new ApiError('Exchange rate limit hit', 429))
    expect((await post({ exchange: 'bitget', symbol: 'BTC/USDT' })).status).toBe(429)
  })
  it('retains the single-symbol detail response', async () => {
    mocks.create.mockResolvedValue({ id: 'bitget' })
    mocks.detail.mockResolvedValue({ symbol: 'BTC/USDT', order_book: {}, ohlcv: {} })
    const response = await post({ exchange: 'bitget', symbol: 'BTC/USDT' })
    expect(response.status).toBe(200)
    expect((await response.json()).data).toMatchObject({ order_book: {}, ohlcv: {} })
    expect(mocks.get).not.toHaveBeenCalled()
  })
})
