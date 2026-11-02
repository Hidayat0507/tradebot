import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createSupabaseSchedulerDeps } from '@/lib/strategy/supabase-scheduler-deps'
import { parsePine } from '@/lib/strategy/pine/parser'
import { SAMPLE_PINE } from '@/lib/strategy/samples'

const { runPaperTick, createServiceClient } = vi.hoisted(() => ({ runPaperTick: vi.fn(), createServiceClient: vi.fn(() => ({})) }))
vi.mock('@/lib/strategy/paper-scheduler', async (orig) => ({ ...(await orig<object>()), runPaperTick }))
vi.mock('@/utils/supabase/server', () => ({ createServiceClient }))

const SECRET = 'cron-secret-0123456789abcdef'
const req = (auth?: string) => new NextRequest('http://localhost/api/cron/paper-strategies', { headers: auth ? { authorization: auth } : {} })

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('cron auth', () => {
  it('fails closed', () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, undefined)).toBe(false)
    expect(isAuthorizedCron('Bearer short', 'short')).toBe(false)
    expect(isAuthorizedCron(SECRET, SECRET)).toBe(false)
    expect(isAuthorizedCron(`Bearer ${SECRET}x`, SECRET)).toBe(false)
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET)).toBe(true)
  })
})

describe('GET /api/cron/paper-strategies', () => {
  it('503 when CRON_SECRET unset, 401 on bad token, never touching Supabase', async () => {
    const { GET } = await import('@/app/api/cron/paper-strategies/route')
    vi.stubEnv('CRON_SECRET', '')
    expect((await GET(req(`Bearer ${SECRET}`))).status).toBe(503)
    vi.stubEnv('CRON_SECRET', SECRET)
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('Bearer nope'))).status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(runPaperTick).not.toHaveBeenCalled()
  })
  it('runs one tick when authorized', async () => {
    const { GET } = await import('@/app/api/cron/paper-strategies/route')
    vi.stubEnv('CRON_SECRET', SECRET)
    runPaperTick.mockResolvedValue([{ botId: 'b', status: 'ok', orders: 1 }])
    const res = await GET(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, mode: 'paper', results: [{ botId: 'b', status: 'ok', orders: 1 }] })
    expect(runPaperTick).toHaveBeenCalledTimes(1)
  })
})

/** Minimal chainable fake of the supabase-js query builder. */
function fakeSupabase(rows: unknown[], insertError: { code?: string } | null = null) {
  const calls: { table: string; op: string; args: unknown[] }[] = []
  const builder = (table: string) => {
    const b: Record<string, unknown> = {}
    const chain = (op: string) => (...args: unknown[]) => { calls.push({ table, op, args }); return b }
    for (const op of ['select', 'eq', 'limit', 'update']) b[op] = chain(op)
    b.insert = (...args: unknown[]) => { calls.push({ table, op: 'insert', args }); return Promise.resolve({ error: insertError }) }
    b.then = (res: (v: unknown) => unknown) => res({ data: rows, error: null })
    return b
  }
  return { client: { from: (t: string) => builder(t), rpc: async () => ({ data: insertError ? 'duplicate' : 'claimed', error: null }) } as never, calls }
}

describe('createSupabaseSchedulerDeps', () => {
  const def = parsePine(SAMPLE_PINE.emaCross)
  const row = (over: object = {}) => ({
    bot_id: 'b1', definition: def, timeframe: '1h', paper_quote_size: '50', last_candle_time: '2026-01-01T00:00:00Z',
    bots: { id: 'b1', user_id: 'u1', name: 'n', exchange: 'Binance', pair: 'BTC/USDT', enabled: true, mode: 'paper' }, ...over,
  })
  it('loads enabled paper strategies without credentials; skips invalid/disabled/non-allowlisted', async () => {
    const { client, calls } = fakeSupabase([
      row(),
      row({ bot_id: 'b2', definition: { version: 1, rules: [{ when: { type: 'js' } }] } }),
      row({ bot_id: 'b3', bots: { id: 'b3', user_id: 'u', name: 'n', exchange: 'binance', pair: 'X/Y', enabled: false } }),
      row({ bot_id: 'b4', bots: { id: 'b4', user_id: 'u', name: 'n', exchange: 'hyperliquid', pair: 'X/Y', enabled: true, mode: 'live' } }),
    ])
    const loaded = await createSupabaseSchedulerDeps(client).loadEnabled()
    expect(loaded.map((s) => s.bot.id)).toEqual(['b1'])
    expect(loaded[0]).toMatchObject({ paperQuoteSize: 50, lastCandleTime: Date.parse('2026-01-01T00:00:00Z'), bot: { mode: 'paper', exchange: 'binance', api_key: '', api_secret: '' } })
    const sel = String(calls.find((c) => c.op === 'select')!.args[0])
    expect(sel).not.toMatch(/api_key|api_secret|password|webhook_secret/)
    expect(calls.filter((c) => c.op === 'eq').map((c) => c.args)).toEqual([['enabled', true], ['mode', 'paper']])
  })
  it('loads opted-in Hyperliquid testnet routing without loading credentials', async () => {
    const { client, calls } = fakeSupabase([row({ allow_testnet: true, max_orders_per_day: 2, kill_switch_tripped_at: null,
      bots: { id: 'b1', user_id: 'u1', name: 'n', exchange: 'hyperliquid', pair: 'BTC/USDC:USDC', enabled: true, mode: 'testnet' } })])
    expect(await createSupabaseSchedulerDeps(client).loadEnabled()).toEqual([expect.objectContaining({
      allowTestnet: true, maxOrdersPerDay: 2, killSwitchTrippedAt: null,
      bot: expect.objectContaining({ mode: 'testnet', api_key: '', api_secret: '' }),
    })])
    expect(String(calls.find(c => c.op === 'select')!.args[0])).not.toMatch(/api_secret|api_key/)
  })
  it('claimSignal: duplicate → false; cursor update scoped to bot', async () => {
    const dup = createSupabaseSchedulerDeps(fakeSupabase([], { code: '23505' }).client)
    expect(await dup.claimSignal('b1', 'a', 't')).toBe(false)
    const { client, calls } = fakeSupabase([])
    const d = createSupabaseSchedulerDeps(client)
    expect(await d.claimSignal('b1', 'a', 't')).toBe(true)
    await d.saveCursor('b1', 0)
    expect(calls.filter((c) => c.table === 'bot_strategies').map((c) => [c.op, c.args])).toEqual([
      ['update', [{ last_candle_time: '1970-01-01T00:00:00.000Z' }]], ['eq', ['bot_id', 'b1']],
    ])
  })
  it('fetchCandles uses injected public exchange, cached per exchange', async () => {
    const fetchOHLCV = vi.fn().mockResolvedValue([[1, 1, 2, 0.5, 1.5, 10]])
    const publicExchange = vi.fn().mockResolvedValue({ fetchOHLCV })
    const d = createSupabaseSchedulerDeps(fakeSupabase([]).client, { publicExchange })
    await d.fetchCandles('binance', 'BTC/USDT', '1h', 10)
    await d.fetchCandles('binance', 'ETH/USDT', '1h', 10)
    expect(publicExchange).toHaveBeenCalledTimes(1)
  })
})
