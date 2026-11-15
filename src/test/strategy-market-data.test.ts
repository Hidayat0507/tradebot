import { describe, expect, it, vi } from 'vitest'
import { fetchPublicCandles } from '@/lib/strategy/market-data'
import { LIMITS } from '@/lib/strategy/types'

const valid = [1_700_000_000_000, 100, 110, 90, 105, 0]

describe('public candle validation', () => {
  it.each([NaN, Infinity, -Infinity])('drops rows containing %s in any OHLCV field', async value => {
    const malformed = valid.map((_, index) => valid.map((field, i) => i === index ? value : field))
    const source = { fetchOHLCV: vi.fn().mockResolvedValue([valid, ...malformed, valid]) }

    expect(await fetchPublicCandles(source, 'BTC/USDT')).toEqual([
      { time: valid[0], open: 100, high: 110, low: 90, close: 105, volume: 0 },
      { time: valid[0], open: 100, high: 110, low: 90, close: 105, volume: 0 },
    ])
    expect(source.fetchOHLCV).toHaveBeenCalledWith('BTC/USDT', '1h', undefined, 500)
  })

  it('keeps finite rows and rejects incomplete or undefined fields', async () => {
    const source = { fetchOHLCV: vi.fn().mockResolvedValue([
      valid.slice(0, 5), [valid[0], 100, 110, 90, undefined, 10], valid,
    ]) }

    expect(await fetchPublicCandles(source, 'ETH/USDT', '4h', LIMITS.maxCandles + 1)).toEqual([
      { time: valid[0], open: 100, high: 110, low: 90, close: 105, volume: 0 },
    ])
    expect(source.fetchOHLCV).toHaveBeenCalledWith('ETH/USDT', '4h', undefined, LIMITS.maxCandles)
  })
})
