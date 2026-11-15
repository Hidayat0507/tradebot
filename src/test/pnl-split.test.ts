import { describe, expect, it } from 'vitest'
import { splitByMode, type ModeTrade } from '@/lib/pnl-split'

const now = Date.parse('2026-11-15T12:00:00Z')
const day = 86_400_000
const trade = (pnl: number | null, time: number): ModeTrade => ({
  pnl, timestamp: new Date(time).toISOString(),
})

describe('dashboard 24-hour PnL window', () => {
  it.each([
    { name: 'live', flags: {}, bucket: 'live' as const },
    { name: 'paper', flags: { paper: true }, bucket: 'paper' as const },
    { name: 'simulated', flags: { simulated: true }, bucket: 'paper' as const },
  ])('excludes future gains and losses from $name 24h totals, preserving history', ({ flags, bucket }) => {
    const trades = [trade(5, now - 1), trade(100, now + 1), trade(-20, now + day)]
      .map(row => ({ ...row, ...flags }))
    const result = splitByMode(trades, now)

    expect(result[bucket]).toEqual({ pnl24h: 5, pnlAll: 85, trades: 3 })
    expect(bucket === 'live' ? result.liveTrades : result.paperTrades).toEqual(trades)
    expect(result[bucket === 'live' ? 'paper' : 'live']).toEqual({ pnl24h: 0, pnlAll: 0, trades: 0 })
  })

  it.each([
    ['before the window', now - day - 1, 0],
    ['at the open lower bound', now - day, 0],
    ['just inside the window', now - day + 1, 7],
    ['at the current time', now, 7],
    ['after the current time', now + 1, 0],
  ] as const)('handles a trade %s', (_, timestamp, expected) => {
    expect(splitByMode([trade(7, timestamp)], now).live).toEqual({
      pnl24h: expected, pnlAll: 7, trades: 1,
    })
  })

  it('keeps null PnL and invalid timestamps out of the 24h total', () => {
    expect(splitByMode([trade(null, now), { pnl: 10, timestamp: 'invalid' }], now).live)
      .toEqual({ pnl24h: 0, pnlAll: 10, trades: 2 })
  })
})
