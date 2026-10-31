import { describe, expect, it } from 'vitest'
import { parsePine, PineParseError } from '@/lib/strategy/pine/parser'
import { SAMPLE_PINE } from '@/lib/strategy/samples'
import { evaluate } from '@/lib/strategy/runtime'
import { backtest } from '@/lib/strategy/backtest'
import { sampleCandles } from '@/lib/strategy/sample-candles'
import { atr, macd, ema, shift } from '@/lib/strategy/indicators'
import type { Candle, StrategyDefinition } from '@/lib/strategy/types'

const candles = sampleCandles(400)
const closes = candles.map((c) => c.close)

describe('indicators phase 2', () => {
  it('atr is rma of true range', () => {
    const a = atr([3, 4, 6], [1, 2, 3], [2, 3, 5], 2)
    // TR = [2, max(2,2,1)=2, max(3,3,0)=3] → seed (2+2)/2=2, then 0.5*3+0.5*2
    expect(a).toEqual([NaN, 2, 2.5])
  })
  it('macd line/signal/hist consistent', () => {
    const m = macd(closes, 12, 26, 9)
    const e12 = ema(closes, 12), e26 = ema(closes, 26)
    expect(m.line[100]).toBeCloseTo(e12[100] - e26[100], 10)
    expect(m.hist[100]).toBeCloseTo(m.line[100] - m.signal[100], 10)
    expect(Number.isNaN(m.signal[30])).toBe(true)
    expect(Number.isNaN(m.signal[60])).toBe(false)
  })
  it('shift', () => expect(shift([1, 2, 3], 1)).toEqual([NaN, 1, 2]))
})

describe('pine phase 2', () => {
  it('history [] references', () => {
    const d = parsePine('strategy("h")\nup = close > close[1] and close[1] > close[2]\nif up\n    strategy.entry("L", strategy.long)\nif close < ta.sma(close, 5)[1]\n    strategy.close("L")')
    const got = evaluate(d, candles).filter((s) => s.action === 'entry').map((s) => s.index)
    const exp = closes.flatMap((c, i) => (i >= 2 && c > closes[i - 1] && closes[i - 1] > closes[i - 2] ? [i] : []))
    expect(got).toEqual(exp)
  })
  it('macd tuple + atr + strategy.exit sample parses and stops/limits fire', () => {
    const d = parsePine(SAMPLE_PINE.macdAtrStops)
    expect(d.vars.map((v) => v.name)).toEqual(['m', 'sig', 'hist', 'a'])
    const exit = d.rules.find((r) => r.action === 'exit')!
    expect(exit.fromEntry).toBe('Long')
    expect(exit.stop && exit.limit).toBeTruthy()
    expect(backtest(d, sampleCandles(1500, 100, 3)).trades.length).toBeGreaterThan(0)
    // tighter levels so they are hit within the synthetic data
    const tight = parsePine(SAMPLE_PINE.macdAtrStops.replace('2 * a', '0.5 * a').replace('3 * a', '1 * a'))
    const r = backtest(tight, sampleCandles(1500, 100, 3))
    expect(r.trades.length).toBeGreaterThan(0)
    expect(r.trades.some((t) => t.exitReason === 'stop' || t.exitReason === 'limit')).toBe(true)
  })
  it('stop fills at stop price, gap fills at open', () => {
    const bar = (i: number, o: number, h: number, l: number, c: number): Candle => ({ time: i, open: o, high: h, low: l, close: c, volume: 1 })
    const cs = [bar(0, 100, 101, 99, 100), bar(1, 100, 101, 99, 100), bar(2, 100, 100, 94, 95), bar(3, 95, 96, 94, 95)]
    const def: StrategyDefinition = {
      version: 1, name: 't', inputs: {}, vars: [],
      rules: [
        { action: 'entry', id: 'L', direction: 'long', when: { type: 'bin', op: '==', left: { type: 'src', name: 'close' }, right: { type: 'num', value: 100 } } },
        { action: 'exit', id: 'X', fromEntry: 'L', when: { type: 'bool', value: true }, stop: { type: 'num', value: 97 } },
      ],
    }
    const r = backtest(def, cs, 0)
    expect(r.trades[0]).toMatchObject({ entryPrice: 100, exitPrice: 97, exitReason: 'stop', exitTime: 2 })
    const gap = backtest(def, [cs[0], cs[1], bar(2, 90, 91, 89, 90), cs[3]], 0)
    expect(gap.trades[0]).toMatchObject({ exitPrice: 90, exitReason: 'stop' })
  })
  it.each([
    ['exit with profit= ticks', 'strategy("x")\nstrategy.entry("L", strategy.long)\nstrategy.exit("X", "L", profit = 100)'],
    ['exit without levels', 'strategy("x")\nstrategy.entry("L", strategy.long)\nstrategy.exit("X", "L")'],
    ['macd without tuple', 'strategy("x")\nm = ta.macd(close, 12, 26, 9)\nstrategy.entry("L", strategy.long)'],
    ['dynamic history offset', 'strategy("x")\nn = 2\nc = close[n]\nstrategy.entry("L", strategy.long)'],
    ['atr non-const length', 'strategy("x")\na = ta.atr(close)\nstrategy.entry("L", strategy.long)'],
  ])('rejects: %s', (_n, src) => expect(() => parsePine(src)).toThrow(PineParseError))
})
