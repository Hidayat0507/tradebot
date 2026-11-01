import { describe, expect, it, vi } from 'vitest'
import * as ccxt from 'ccxt'
import { createPublicTickerService, validateTickerRequest } from '@/lib/public-tickers'

const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']
const ticks = Object.fromEntries(symbols.map(symbol => [symbol, { last: 100, baseVolume: 0, quoteVolume: 20, percentage: 2 }]))

describe('batched public tickers', () => {
  it.each(['bitget', 'hyperliquid'])('uses one native fetchTickers call for %s and no detail or private calls', async exchange => {
    const client = { has: { fetchTickers: true }, fetchTickers: vi.fn().mockResolvedValue(ticks), fetchTicker: vi.fn() }
    const create = vi.fn(async () => client)
    const service = createPublicTickerService(create)
    const rows = await service.get(exchange, symbols)
    expect(create).toHaveBeenCalledWith(exchange)
    expect(client.fetchTickers).toHaveBeenCalledTimes(1)
    expect(client.fetchTickers).toHaveBeenCalledWith([...symbols].sort())
    expect(client.fetchTicker).not.toHaveBeenCalled()
    expect(rows).toEqual(symbols.map(symbol => expect.objectContaining({ symbol, exchange, last_price: 100, volume_24h: 0 })))
  })
  it('deduplicates concurrent batches, caches reordered symbols, and refreshes after TTL', async () => {
    let time = 0
    const fetchTickers = vi.fn(async () => ticks)
    const create = vi.fn(async () => ({ has: { fetchTickers: true }, fetchTickers, fetchTicker: vi.fn() }))
    const service = createPublicTickerService(create, () => time)
    await Promise.all([service.get('BITGET', symbols), service.get('bitget', [...symbols].reverse())])
    expect(fetchTickers).toHaveBeenCalledTimes(1)
    expect((await service.get('bitget', [symbols[2], symbols[1], symbols[0]])).map(row => row.symbol)).toEqual([...symbols].reverse())
    expect(fetchTickers).toHaveBeenCalledTimes(1)
    time = 20_000
    await service.get('bitget', symbols)
    expect(fetchTickers).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenCalledTimes(1)
  })
  it('returns a per-symbol error for missing batch entries', async () => {
    const service = createPublicTickerService(async () => ({ has: { fetchTickers: true },
      fetchTickers: async () => ({ [symbols[0]]: ticks[symbols[0]] }), fetchTicker: vi.fn() }))
    expect(await service.get('bitget', symbols)).toEqual([
      expect.objectContaining({ last_price: 100 }),
      expect.objectContaining({ symbol: symbols[1], error: true }),
      expect.objectContaining({ symbol: symbols[2], error: true }),
    ])
  })
  it('bounds fallback concurrency to two and tolerates unsupported symbols', async () => {
    let active = 0, peak = 0
    const fetchTicker = vi.fn(async (symbol: string) => {
      active++; peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 1))
      active--
      if (symbol === symbols[1]) throw new ccxt.BadSymbol('unsupported')
      return ticks[symbol]
    })
    const service = createPublicTickerService(async () => ({ has: { fetchTickers: 'emulated' }, fetchTicker }))
    const rows = await service.get('bitget', [...symbols, symbols[0]])
    expect(peak).toBe(2)
    expect(fetchTicker).toHaveBeenCalledTimes(3)
    expect(rows).toHaveLength(3)
    expect(rows[1]).toMatchObject({ error: true })
  })
  it('preserves 429, never fans out after batch failure, and permits retry', async () => {
    const fetchTickers = vi.fn().mockRejectedValueOnce(new ccxt.DDoSProtection('429')).mockResolvedValue(ticks)
    const fetchTicker = vi.fn()
    const service = createPublicTickerService(async () => ({ has: { fetchTickers: true }, fetchTickers, fetchTicker }))
    await expect(service.get('bitget', symbols)).rejects.toMatchObject({ statusCode: 429 })
    expect(fetchTicker).not.toHaveBeenCalled()
    expect(await service.get('bitget', symbols)).toHaveLength(3)
  })
  it('retries client initialization after failure', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('init')).mockResolvedValue({ has: { fetchTickers: true }, fetchTickers: async () => ticks })
    const service = createPublicTickerService(create)
    await expect(service.get('bitget', symbols)).rejects.toThrow('init')
    await service.get('bitget', symbols)
    expect(create).toHaveBeenCalledTimes(2)
  })
  it.each([null, [], [''], [123], ['x'.repeat(101)], Array(25).fill('BTC/USDT')])('rejects invalid symbol lists: %s', value => {
    expect(() => validateTickerRequest('bitget', value)).toThrow()
  })
  it('rejects unsupported exchanges', () => {
    expect(() => validateTickerRequest('kraken', symbols)).toThrow('Unsupported')
  })
})
