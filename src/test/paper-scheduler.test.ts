import { describe, expect, it, vi } from 'vitest'
import { runPaperTick, signalsToIntents, type SchedulerDeps, type ScheduledStrategy } from '@/lib/strategy/paper-scheduler'
import { parsePine } from '@/lib/strategy/pine/parser'
import { SAMPLE_PINE } from '@/lib/strategy/samples'
import { sampleCandles } from '@/lib/strategy/sample-candles'
import { evaluate } from '@/lib/strategy/runtime'
import { executeTrade } from '@/app/api/_middleware/webhook/execute-trade'

const HOUR = 3_600_000
const candles = sampleCandles(400)
const def = parsePine(SAMPLE_PINE.emaCross)
const intents = signalsToIntents(evaluate(def, candles))
const bot = { id: 'bot-1', exchange: 'binance', pair: 'BTC/USDT', api_key: 'k', api_secret: 's', user_id: 'u', webhook_secret: 'w', name: 'b', mode: 'live' }

function setup(over: Partial<ScheduledStrategy> = {}, nowIdx?: number) {
  const target = intents[2]
  const lastIdx = nowIdx ?? target.index
  const claimed = new Set<string>()
  const deps: SchedulerDeps & Record<string, ReturnType<typeof vi.fn>> = {
    loadEnabled: vi.fn().mockResolvedValue([{ bot, definition: def, timeframe: '1h', paperQuoteSize: 100, lastCandleTime: null, ...over }]),
    // includes one still-open candle after lastIdx
    fetchCandles: vi.fn().mockResolvedValue(candles.slice(0, lastIdx + 2)),
    claimSignal: vi.fn(async (_b: string, id: string) => (claimed.has(id) ? false : (claimed.add(id), true))),
    executeOrder: vi.fn().mockResolvedValue({ id: 't' }),
    saveCursor: vi.fn().mockResolvedValue(undefined),
    now: vi.fn(() => candles[lastIdx].time + HOUR + 1),
  }
  return { deps, target }
}

describe('signalsToIntents', () => {
  it('alternates buy/sell for long-only EMA cross', () => {
    expect(intents.length).toBeGreaterThan(3)
    intents.forEach((i, k) => expect(i.side).toBe(k % 2 === 0 ? 'buy' : 'sell'))
  })
  it('reversal emits close + opposite entry', () => {
    const out = signalsToIntents([
      { index: 0, time: 0, action: 'entry', id: 'L', direction: 'long', price: 1 },
      { index: 1, time: 1, action: 'entry', id: 'S', direction: 'short', price: 1 },
    ])
    expect(out.map((o) => o.side)).toEqual(['buy', 'sell', 'sell'])
  })
})

describe('runPaperTick', () => {
  it('only acts on the latest closed candle, forces paper mode, uses existing order path inputs', async () => {
    const { deps, target } = setup()
    const r = await runPaperTick(deps)
    expect(r).toEqual([{ botId: 'bot-1', status: 'ok', orders: 1 }])
    const [alert, paperBot] = deps.executeOrder.mock.calls[0]
    expect(paperBot.mode).toBe('paper')
    expect(alert).toMatchObject({ bot_id: 'bot-1', symbol: 'BTC/USDT', action: target.side, price: target.price })
    expect(alert.amount).toBeCloseTo(100 / target.price)
    expect(deps.fetchCandles).toHaveBeenCalledWith('binance', 'BTC/USDT', '1h', 500)
    expect(deps.saveCursor).toHaveBeenCalledWith('bot-1', candles[target.index].time, expect.objectContaining({ time: target.time, summary: expect.stringContaining(target.side) }))
  })
  it('is idempotent: duplicate claim → no second order; no new candle → skipped', async () => {
    const { deps, target } = setup()
    await runPaperTick(deps)
    await runPaperTick(deps)
    expect(deps.executeOrder).toHaveBeenCalledTimes(1)
    const again = await runPaperTick({ ...deps, loadEnabled: vi.fn().mockResolvedValue([{ bot, definition: def, timeframe: '1h', paperQuoteSize: 100, lastCandleTime: candles[target.index].time }]) })
    expect(again[0].status).toBe('skipped')
  })
  it('catches up all intents after the cursor', async () => {
    const { deps } = setup({ lastCandleTime: candles[intents[0].index].time }, intents[3].index)
    const r = await runPaperTick(deps)
    expect(r[0].orders).toBe(3)
    expect(deps.executeOrder.mock.calls.map((c) => c[0].action)).toEqual(['sell', 'buy', 'sell'])
  })
  it('ignores the still-open candle and isolates per-bot errors', async () => {
    const { deps } = setup()
    deps.fetchCandles.mockRejectedValueOnce(new Error('network'))
    expect((await runPaperTick(deps))[0]).toMatchObject({ status: 'error', detail: 'network' })
    expect(deps.executeOrder).not.toHaveBeenCalled()
  })
  it('paper order path produces a paper order without touching an exchange', async () => {
    const { deps, target } = setup()
    const exchange = new Proxy({}, { get: () => { throw new Error('exchange touched') } })
    deps.executeOrder.mockImplementation((alert, b) => executeTrade(exchange as never, alert, alert.price, b))
    await runPaperTick(deps)
    const out = await deps.executeOrder.mock.results[0].value
    expect(out.order).toMatchObject({ paper: true, status: 'closed', price: target.price })
  })
})

describe('paperOrderPath', () => {
  it('refuses non-paper bots before touching anything', async () => {
    const { paperOrderPath } = await import('@/lib/strategy/paper-scheduler')
    await expect(paperOrderPath({})({ bot_id: 'b', symbol: 'BTC/USDT', action: 'buy' }, { ...bot, mode: 'live' })).rejects.toThrow(/paper only/)
  })
})

describe('strategy.exit monitoring', () => {
  const bar = (i: number, o: number, h: number, l: number, c: number) => ({ time: i * HOUR, open: o, high: h, low: l, close: c, volume: 1 })
  const exitDef = parsePine('strategy("x")\nif close == 100\n    strategy.entry("L", strategy.long)\nstrategy.exit("X", "L", stop = 97, limit = 104)')
  it('stop hit → sell at stop', () => {
    const cs = [bar(0, 100, 101, 99, 100), bar(1, 100, 101, 96, 98), bar(2, 98, 99, 97, 98)]
    const out = signalsToIntents(evaluate(exitDef, cs), cs)
    expect(out.map((o) => [o.side, o.reason, o.price, o.index])).toEqual([['buy', 'entry:L', 100, 0], ['sell', 'stop:L', 97, 1]])
  })
  it('limit hit → sell at limit; gap through stop → fill at open', () => {
    const lim = [bar(0, 100, 101, 99, 100), bar(1, 101, 105, 100, 103)]
    expect(signalsToIntents(evaluate(exitDef, lim), lim)[1]).toMatchObject({ side: 'sell', reason: 'limit:L', price: 104 })
    const gap = [bar(0, 100, 101, 99, 100), bar(1, 95, 96, 94, 95)]
    expect(signalsToIntents(evaluate(exitDef, gap), gap)[1]).toMatchObject({ reason: 'stop:L', price: 95 })
  })
  it('scheduler sends the stop as a paper sell on the next tick', async () => {
    const cs = [bar(0, 99, 99, 98, 99), bar(1, 99, 101, 99, 100), bar(2, 100, 101, 96, 98), bar(3, 98, 99, 97, 98)]
    const executeOrder = vi.fn().mockResolvedValue({})
    const deps: SchedulerDeps = {
      loadEnabled: async () => [{ bot, definition: exitDef, timeframe: '1h', paperQuoteSize: 100, lastCandleTime: cs[1].time }],
      fetchCandles: async () => cs,
      claimSignal: async () => true,
      executeOrder,
      saveCursor: async () => {},
      now: () => cs[2].time + HOUR + 1, // bar 3 still open
    }
    expect((await runPaperTick(deps))[0].orders).toBe(1)
    expect(executeOrder.mock.calls[0][0]).toMatchObject({ action: 'sell', price: 97 })
    expect(executeOrder.mock.calls[0][1].mode).toBe('paper')
  })
})
