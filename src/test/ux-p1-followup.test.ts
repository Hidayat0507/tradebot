import { describe, expect, it } from 'vitest'
import { friendlyError, requestFailure } from '@/lib/friendly-error'
import { tradesCsv } from '@/lib/trade-export'
import type { TradeEntry } from '@/components/trades-table'

describe('safe, actionable error messages', () => {
  it.each([
    [{ code: 'invalid_credentials' }, 'email or password'],
    [{ code: 'email_not_confirmed' }, 'confirm your email'],
    [{ code: 'PGRST301' }, 'sign in again'],
    [requestFailure(401), 'sign in again'],
    [requestFailure(403), 'permission'],
    [{ code: 'PGRST116' }, 'no longer available'],
    [requestFailure(404), 'no longer available'],
    [requestFailure(429), 'wait a moment'],
    [new TypeError('Failed to fetch'), 'Check your connection'],
    [{ name: 'AbortError' }, 'Check your connection'],
    [{ name: 'TimeoutError' }, 'Check your connection'],
  ])('maps %j', (error, expected) => {
    expect(friendlyError(error)).toContain(expected)
  })
  it.each([null, undefined, 'raw backend text', new Error('private database constraint'), { message: 'secret credential', code: '23505' }, requestFailure(500)])('never reflects arbitrary failure details: %j', error => {
    expect(friendlyError(error, 'We could not load your bots. Please try again.')).toBe('We could not load your bots. Please try again.')
  })
  it('does not echo response text alongside a recognized error', () => {
    const message = friendlyError({ status: 429, message: 'secret credential' })
    expect(message).toContain('wait a moment')
    expect(message).not.toContain('secret')
  })
})

const trade: TradeEntry = {
  id: 'trade-1', botId: 'bot-1', botName: 'My bot', symbol: 'BTC/USDT',
  side: 'buy', status: 'filled', size: 0.01, price: 100, pnl: -2,
  timestamp: '2026-11-01T00:00:00Z',
}

describe('trade history CSV', () => {
  it('exports all supplied rows with explicit live/paper mode and unambiguous timestamps', () => {
    const csv = tradesCsv([trade, { ...trade, id: 'paper-1', paper: true }, { ...trade, id: 'sim-1', simulated: true }])
    expect(csv.split('\r\n')).toHaveLength(5)
    expect(csv).toContain('"live","0.01","100","-2","2026-11-01T00:00:00Z"')
    expect(csv.match(/"paper"/g)).toHaveLength(2)
    expect(csv).toContain('"Time (ISO 8601)"')
  })
  it('escapes commas, quotes and newlines, leaving missing PnL blank', () => {
    expect(tradesCsv([{ ...trade, botName: 'Bot, "one"\nsecond line', pnl: null }])).toContain('"Bot, ""one""\nsecond line"')
    expect(tradesCsv([{ ...trade, pnl: null }])).toContain('"100","","2026-11-01')
  })
  it.each(['=HYPERLINK("x")', '+123', '-123', '@SUM(A1)', '  =1+1', '\t=1+1'])('neutralizes spreadsheet formulas in labels: %s', botName => {
    expect(tradesCsv([{ ...trade, botName }])).toContain(`"'${botName.replace(/"/g, '""')}"`)
  })
})
