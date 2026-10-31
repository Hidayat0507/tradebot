import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { computePaperPnl, strategyHealth, type PaperTradeRow } from '@/lib/strategy/dashboard'

const { getAuthenticatedUser, auth } = vi.hoisted(() => {
  const auth: { value: unknown } = { value: null }
  const getAuthenticatedUser = { mockResolvedValue: (v: unknown) => { auth.value = v }, mockReset: () => { auth.value = null } }
  return { getAuthenticatedUser, auth }
})
vi.mock('@/app/api/_middleware/api-handler', async (orig) => {
  const m = await orig<typeof import('@/app/api/_middleware/api-handler')>()
  return { ...m, getAuthenticatedUser: async () => { if (!auth.value) throw new m.ApiError('Unauthorized', 401); return auth.value } }
})

const t = (i: number, side: string, size: number, price: number, over: Partial<PaperTradeRow> = {}): PaperTradeRow => ({
  id: `t${i}`, bot_id: 'b1', symbol: 'BTC/USDT', side, size, price, pnl: null, external_id: `paper-${i}`,
  created_at: `2026-01-01T00:0${i}:00Z`, ...over,
})

describe('computePaperPnl', () => {
  it('FIFO realized PnL, win rate, open size; ignores live trades and bad rows', () => {
    const r = computePaperPnl([
      t(3, 'sell', 1, 90),            // closes rest of lot1 (0.5@100) + 0.5 of lot2(@110)
      t(1, 'buy', 1, 100),
      t(2, 'sell', 0.5, 120),         // +10
      t(4, 'buy', 1, 110, { created_at: '2026-01-01T00:02:30Z' }),
      t(5, 'buy', 9, 1, { external_id: 'live-order' }),
      t(6, 'buy', 0, 100),
      t(7, 'sell', 1, 50, { bot_id: 'b2' }), // unmatched sell → ignored
    ])
    // third: 0.5*(90-100) + 0.5*(90-110) = -15
    expect(r.realized).toBeCloseTo(-5)
    expect(r.closedTrades).toBe(2)
    expect(r.wins).toBe(1)
    expect(r.winRate).toBe(0.5)
    expect(r.byBot.b1.openSize).toBeCloseTo(0.5)
  })
})

describe('strategyHealth', () => {
  const now = Date.parse('2026-01-01T10:00:00Z')
  it.each([
    [{ enabled: false, timeframe: '1h', last_candle_time: null }, 'disabled'],
    [{ enabled: true, timeframe: '1h', last_candle_time: null }, 'waiting'],
    [{ enabled: true, timeframe: '1h', last_candle_time: '2026-01-01T08:00:00Z' }, 'ok'],
    [{ enabled: true, timeframe: '1h', last_candle_time: '2026-01-01T04:00:00Z' }, 'stale'],
  ] as const)('%o → %s', (s, h) => expect(strategyHealth(s, now)).toBe(h))
})

function fakeClient(strategies: unknown[], trades: unknown[]) {
  const calls: { table: string; op: string; args: unknown[] }[] = []
  return {
    calls,
    from(table: string) {
      const b: Record<string, unknown> = {}
      for (const op of ['select', 'eq', 'like', 'order', 'limit']) b[op] = (...args: unknown[]) => { calls.push({ table, op, args }); return b }
      b.then = (res: (v: unknown) => unknown) => res({ data: table === 'trades' ? trades : strategies, error: null })
      return b
    },
  }
}

describe('GET /api/strategy/dashboard', () => {
  beforeEach(() => getAuthenticatedUser.mockReset())
  it('401 when not signed in', async () => {
    const { GET } = await import('@/app/api/strategy/dashboard/route')
    expect((await GET(new NextRequest('http://localhost/api/strategy/dashboard'))).status).toBe(401)
  })
  it('returns status, paper trades only (filtered in query) and PnL, scoped to user', async () => {
    const client = fakeClient(
      [{ bot_id: 'b1', name: 'EMA', enabled: true, timeframe: '1h', last_candle_time: null, last_signal_at: null, last_signal: null, bots: { name: 'n', pair: 'BTC/USDT' } }],
      [t(2, 'sell', 1, 110), t(1, 'buy', 1, 100)],
    )
    getAuthenticatedUser.mockResolvedValue({ user: { id: 'u1' }, supabase: client })
    const { GET } = await import('@/app/api/strategy/dashboard/route')
    const res = await GET(new NextRequest('http://localhost/api/strategy/dashboard'))
    const { data } = await res.json()
    expect(data.mode).toBe('paper')
    expect(data.strategies[0].health).toBe('waiting')
    expect(data.pnl.realized).toBe(10)
    expect(client.calls).toContainEqual({ table: 'trades', op: 'like', args: ['external_id', 'paper-%'] })
    expect(client.calls.filter((c) => c.op === 'eq')).toEqual([
      { table: 'bot_strategies', op: 'eq', args: ['user_id', 'u1'] }, { table: 'trades', op: 'eq', args: ['user_id', 'u1'] },
    ])
  })
})
