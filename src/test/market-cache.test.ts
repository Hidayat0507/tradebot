import { afterEach, describe, expect, it, vi } from 'vitest'
import { marketCache } from '@/lib/market-cache'

vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn() } }))

const entries = [
  ['bitget', 'BTC/USDT', 'ticker'],
  ['bitget', 'BTC/USDT', 'orderBook'],
  ['bitget', 'BTC/USDT:USDT', 'ticker'],
  ['bitget', 'ETH/USDT', 'ticker'],
  ['bitget-extra', 'BTC/USDT', 'ticker'],
  ['hyperliquid', 'BTC/USDT', 'ticker'],
  ['bitget', 'BTC/USDT', 'ticker-extra'],
] as const

afterEach(() => {
  marketCache.clear()
  vi.useRealTimers()
})

describe('market cache expiry', () => {
  it.each([
    ['ticker', 20_000],
    ['orderBook', 20_000],
    ['ohlcv', 60_000],
    ['custom', 20_000],
    ['constructor', 20_000],
    ['toString', 20_000],
    ['__proto__', 20_000],
  ])('expires %s entries exactly at their %i ms TTL', (dataType, ttl) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    marketCache.set('bitget', 'BTC/USDT', dataType, { price: 100 })

    vi.advanceTimersByTime(ttl - 1)
    expect(marketCache.get('bitget', 'BTC/USDT', dataType)).toEqual({ price: 100 })
    vi.advanceTimersByTime(1)
    expect(marketCache.get('bitget', 'BTC/USDT', dataType)).toBeNull()
    expect(marketCache.getStats().size).toBe(0)
  })

  it('refreshes the expiry when an entry is replaced', () => {
    vi.useFakeTimers()
    marketCache.set('bitget', 'BTC/USDT', 'ticker', 100)
    vi.advanceTimersByTime(10_000)
    marketCache.set('bitget', 'BTC/USDT', 'ticker', 101)
    vi.advanceTimersByTime(10_000)
    expect(marketCache.get('bitget', 'BTC/USDT', 'ticker')).toBe(101)
    vi.advanceTimersByTime(10_000)
    expect(marketCache.get('bitget', 'BTC/USDT', 'ticker')).toBeNull()
  })
})

describe('market cache selective invalidation', () => {
  it.each([
    { filters: ['BITGET'], removed: [0, 1, 2, 3, 6] },
    { filters: [undefined, 'BTC/USDT'], removed: [0, 1, 4, 5, 6] },
    { filters: [undefined, undefined, 'ticker'], removed: [0, 2, 3, 4, 5] },
    { filters: ['bitget', 'BTC/USDT'], removed: [0, 1, 6] },
    { filters: ['bitget', undefined, 'ticker'], removed: [0, 2, 3] },
    { filters: [undefined, 'BTC/USDT', 'ticker'], removed: [0, 4, 5] },
    { filters: ['bitget', 'BTC/USDT', 'ticker'], removed: [0] },
    { filters: ['bitget', 'BTC/USDT:USDT', 'ticker'], removed: [2] },
    { filters: ['missing'], removed: [] },
    { filters: [], removed: [0, 1, 2, 3, 4, 5, 6] },
  ])('clears only matching entries for $filters', ({ filters, removed }) => {
    entries.forEach(([exchange, symbol, type], index) => {
      marketCache.set(exchange, symbol, type, { index })
    })

    marketCache.clear(...filters)

    entries.forEach(([exchange, symbol, type], index) => {
      expect(marketCache.get(exchange, symbol, type)).toEqual(
        removed.includes(index) ? null : { index },
      )
    })
    expect(marketCache.getStats().size).toBe(entries.length - removed.length)
  })
})
