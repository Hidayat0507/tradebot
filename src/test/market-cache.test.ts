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

afterEach(() => marketCache.clear())

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
