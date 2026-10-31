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
    expect(deps.saveCursor).toHaveBeenCalledWith('bot-1', candles[target.index].time)
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
