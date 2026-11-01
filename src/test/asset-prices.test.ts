import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLivePrices } from '@/lib/asset-prices'

afterEach(() => vi.unstubAllGlobals())
const reply = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) })

describe('asset valuation quotes', () => {
  it('uses live quotes, including stablecoin deviations, and never substitutes a missing price', async () => {
    const fetch = vi.fn().mockResolvedValue(reply([
      { symbol: 'BTC/USDT', last_price: 123456 },
      { symbol: 'USDC/USDT', last_price: 0.98 },
      { symbol: 'BAD/USDT', last_price: -1 },
      { symbol: 'ERR/USDT', last_price: 20, error: true },
      { symbol: 'NAN/USDT', last_price: NaN },
    ]))
    vi.stubGlobal('fetch', fetch)
    expect(await fetchLivePrices('bitget', ['BTC', 'USDC', 'USDT', 'BAD', 'ERR', 'NAN', 'MISSING'])).toEqual({
      BTC: 123456, USDC: 0.98, USDT: 1, BAD: null, ERR: null, NAN: null, MISSING: null,
    })
    expect(JSON.parse(fetch.mock.calls[0][1].body).symbols).not.toContain('USDT/USDT')
  })

  it('splits portfolios at the route limit and deduplicates assets', async () => {
    const fetch = vi.fn().mockResolvedValue(reply([]))
    vi.stubGlobal('fetch', fetch)
    const assets = Array.from({ length: 25 }, (_, i) => `ASSET${i}`)
    await fetchLivePrices('bitget', [...assets, assets[0]])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls.map(call => JSON.parse(call[1].body).symbols.length)).toEqual([24, 1])
  })

  it('uses USDC quotes on Hyperliquid', async () => {
    const fetch = vi.fn().mockResolvedValue(reply([{ symbol: 'ETH/USDC', last_price: 4000 }]))
    vi.stubGlobal('fetch', fetch)
    expect(await fetchLivePrices('hyperliquid', ['ETH', 'USDC'])).toEqual({ ETH: 4000, USDC: 1 })
    expect(JSON.parse(fetch.mock.calls[0][1].body).symbols).toEqual(['ETH/USDC'])
  })

  it.each(['http', 'network', 'malformed'])('marks prices unavailable on %s failure', async failure => {
    vi.stubGlobal('fetch', failure === 'network' ? vi.fn().mockRejectedValue(new Error('offline'))
      : vi.fn().mockResolvedValue(failure === 'http' ? { ok: false } : reply(null)))
    expect(await fetchLivePrices('bitget', ['BTC'])).toEqual({ BTC: null })
  })
})
