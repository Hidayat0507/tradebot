import { afterEach, describe, expect, it, vi } from 'vitest'
import { runPaperTick, schedulerBot, schedulerOrderPath, type ScheduledStrategy, type SchedulerDeps } from '@/lib/strategy/paper-scheduler'
import { createSupabaseSchedulerDeps } from '@/lib/strategy/supabase-scheduler-deps'
import { saveBotStrategy } from '@/lib/strategy/bot-strategy-store'
import { strategyHealth } from '@/lib/strategy/dashboard'
import { parsePine } from '@/lib/strategy/pine/parser'
import { SAMPLE_PINE } from '@/lib/strategy/samples'
import { sampleCandles } from '@/lib/strategy/sample-candles'
import { evaluate } from '@/lib/strategy/runtime'
import { signalsToIntents } from '@/lib/strategy/paper-scheduler'

const { processWebhookAlert } = vi.hoisted(() => ({ processWebhookAlert: vi.fn() }))
vi.mock('@/app/api/_middleware/webhook/process-webhook', () => ({ processWebhookAlert }))
afterEach(() => vi.clearAllMocks())
const bot = { id: 'b', user_id: 'u', name: 'b', exchange: 'hyperliquid', pair: 'BTC/USDC:USDC', api_key: '', api_secret: '', webhook_secret: '', mode: 'paper' as const }
const definition = parsePine(SAMPLE_PINE.emaCross)
const candles = sampleCandles(400)
const target = signalsToIntents(evaluate(definition, candles))[2]
function tick(over: Partial<ScheduledStrategy> = {}) {
  const deps: SchedulerDeps = {
    loadEnabled: async () => [{ bot, definition, timeframe: '1h', paperQuoteSize: 20, lastCandleTime: null, ...over }],
    now: () => candles[target.index].time + 3_600_001,
    fetchCandles: vi.fn(async () => candles.slice(0, target.index + 2)),
    claimSignal: vi.fn(async () => true), executeOrder: vi.fn(async () => ({})), saveCursor: vi.fn(async () => {}),
  }
  return deps
}

describe('scheduler mode defense in depth', () => {
  it('rejects adversarial ScheduledStrategy modes before any claim or execution', async () => {
    let seed = 12345
    const fuzz = Array.from({ length: 100 }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; return `mode-${seed}` })
    for (const mode of ['live', '', undefined, null, 'TESTNET', {}, ...fuzz]) {
      for (const allowTestnet of [false, true]) {
        const deps = tick({ bot: { ...bot, mode } as never, allowTestnet })
        expect((await runPaperTick(deps))[0].status).toBe('error')
        expect(deps.executeOrder).not.toHaveBeenCalled()
        expect(deps.claimSignal).not.toHaveBeenCalled()
        await expect(schedulerOrderPath({})({ bot_id: 'b', symbol: bot.pair, action: 'buy' }, { ...bot, mode } as never)).rejects.toThrow(/paper\/testnet/)
      }
    }
    expect(processWebhookAlert).not.toHaveBeenCalled()
  })
  it.each([['paper', true, 'paper'], ['paper', false, 'paper'], ['testnet', false, 'paper'], ['testnet', true, 'testnet']] as const)('%s + opt-in %s routes %s', async (mode, allowTestnet, expected) => {
    const deps = tick({ bot: { ...bot, mode }, allowTestnet })
    await runPaperTick(deps)
    expect(deps.executeOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mode: expected }))
    expect(schedulerBot({ ...bot, mode }, allowTestnet).mode).toBe(expected)
  })
  it('a persisted trip blocks every later day without clearing itself', async () => {
    const deps = tick({ killSwitchTrippedAt: '2026-01-01T00:00:00Z' })
    expect((await runPaperTick(deps))[0]).toMatchObject({ status: 'skipped', detail: 'kill switch tripped' })
    expect(deps.fetchCandles).not.toHaveBeenCalled()
    expect(deps.executeOrder).not.toHaveBeenCalled()
  })
  it('a refused cap reservation never executes an order', async () => {
    const deps = tick()
    deps.claimSignal = vi.fn(async () => false)
    expect((await runPaperTick(deps))[0].orders).toBe(0)
    expect(deps.executeOrder).not.toHaveBeenCalled()
  })
})

// Query fake returns data by table and records mutations; no network, no credentials.
function client(tables: Record<string, unknown>, rpcData: unknown = 'claimed') {
  const writes: { table: string; fields: Record<string, unknown> }[] = []
  const calls: { table: string; op: string; args: unknown[] }[] = []
  const from = (table: string) => {
    const b: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'not', 'order', 'limit', 'is']) b[op] = (...args: unknown[]) => { calls.push({ table, op, args }); return b }
    for (const op of ['update', 'insert']) b[op] = (fields: Record<string, unknown>) => { writes.push({ table, fields }); return b }
    b.single = b.maybeSingle = async () => ({ data: tables[table] ?? null, error: null })
    b.then = (resolve: (v: unknown) => unknown) => resolve({ data: tables[table] ?? null, error: null })
    return b
  }
  const rpc = vi.fn(async () => ({ data: rpcData, error: null }))
  return { db: { from, rpc } as never, writes, calls, rpc }
}

describe('testnet save gate', () => {
  it.each(['paper', 'live', undefined])('rejects opt-in for %s bot without writing', async mode => {
    const c = client({ bots: { mode } })
    expect(await saveBotStrategy(c.db, 'u', 'b', { pine: SAMPLE_PINE.emaCross, allow_testnet: true, reviewed_rules: true })).toMatchObject({ ok: false, status: 400 })
    expect(c.writes).toEqual([])
  })
  it('requires review, validates caps and ignores client guard fields', async () => {
    const c = client({ bots: { mode: 'testnet' }, bot_strategies: { bot_id: 'b' } })
    const input = { pine: SAMPLE_PINE.emaCross, allow_testnet: true }
    expect(await saveBotStrategy(c.db, 'u', 'b', input)).toMatchObject({ status: 400 })
    for (const cap of [0, 51, 1.5]) expect(await saveBotStrategy(c.db, 'u', 'b', { ...input, reviewed_rules: true, max_orders_per_day: cap })).toMatchObject({ status: 400 })
    expect(await saveBotStrategy(c.db, 'u', 'b', { ...input, reviewed_rules: true, kill_switch_tripped_at: null })).toMatchObject({ ok: true })
    expect(c.writes[0].fields).toMatchObject({ allow_testnet: true, max_orders_per_day: 5 })
    expect(c.writes[0].fields).not.toHaveProperty('kill_switch_tripped_at')
  })
})

describe('Supabase order boundary and loss guard', () => {
  it('rechecks current mode and refuses a bot changed to live', async () => {
    const c = client({ bots: { mode: 'live', enabled: true } })
    await expect(createSupabaseSchedulerDeps(c.db).executeOrder({ bot_id: 'b', symbol: bot.pair, action: 'buy' }, { ...bot, mode: 'testnet' })).rejects.toThrow(/eligible/)
    expect(processWebhookAlert).not.toHaveBeenCalled()
    expect(c.calls.some(x => String(x.args[0]).includes('api_secret'))).toBe(false)
  })
  it.each([[-1, -2, -3], [-1, 0, -3], [-1, 1, -3]])('trips only after three consecutive losing closes %s/%s/%s', async (a, b, c) => {
    const fake = client({ bots: { mode: 'testnet', enabled: true }, trades: [{ pnl: a }, { pnl: b }, { pnl: c }] })
    processWebhookAlert.mockResolvedValue({ pnl: -1 })
    const deps = createSupabaseSchedulerDeps(fake.db, { now: () => Date.UTC(2026, 10, 2) })
    await deps.executeOrder({ bot_id: 'b', symbol: bot.pair, action: 'sell' }, { ...bot, mode: 'testnet' })
    const trips = fake.writes.filter(w => w.fields.kill_switch_tripped_at)
    expect(trips.length).toBe(a < 0 && b < 0 && c < 0 ? 1 : 0)
    if (trips.length) expect(trips[0].fields.kill_switch_tripped_at).toBe('2026-11-02T00:00:00.000Z')
    expect(processWebhookAlert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mode: 'testnet' }), fake.db)
  })
  it('a winning close after clear does not re-trip on historical losses', async () => {
    const c = client({ bots: { mode: 'paper', enabled: true }, trades: [{ pnl: -1 }, { pnl: -1 }, { pnl: -1 }] })
    processWebhookAlert.mockResolvedValue({ pnl: 1 })
    await createSupabaseSchedulerDeps(c.db).executeOrder({ bot_id: 'b', symbol: bot.pair, action: 'sell' }, bot)
    expect(c.writes).toEqual([])
  })
  it('dashboard prioritizes tripped guard status', () => {
    expect(strategyHealth({ enabled: false, timeframe: '1h', last_candle_time: null, kill_switch_tripped_at: '2026-01-01' }, Date.now())).toBe('stopped')
  })
})
