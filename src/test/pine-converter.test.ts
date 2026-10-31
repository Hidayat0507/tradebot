import { describe, expect, it } from 'vitest'
import { parsePine, PineParseError } from '@/lib/strategy/pine/parser'
import { convertPine, type AiConverter } from '@/lib/strategy/converter'
import { SAMPLE_PINE } from '@/lib/strategy/samples'
import { evaluate } from '@/lib/strategy/runtime'
import { backtest } from '@/lib/strategy/backtest'
import { sampleCandles } from '@/lib/strategy/sample-candles'
import { ema, crossover } from '@/lib/strategy/indicators'

const candles = sampleCandles(400)

describe('pine parser', () => {
  it('EMA cross parses to expected definition and signals match hand-computed crossovers', () => {
    const d = parsePine(SAMPLE_PINE.emaCross)
    expect(d.name).toBe('EMA Cross')
    expect(d.inputs).toEqual({ fastLen: 9, slowLen: 21 })
    expect(d.rules.map((r) => r.action)).toEqual(['entry', 'close'])
    const closes = candles.map((c) => c.close)
    const expected = crossover(ema(closes, 9), ema(closes, 21)).flatMap((v, i) => (v ? [i] : []))
    const got = evaluate(d, candles).filter((s) => s.action === 'entry').map((s) => s.index)
    expect(got).toEqual(expected)
    expect(got.length).toBeGreaterThan(0)
  })
  it('RSI with when= parses and trades', () => {
    const d = parsePine(SAMPLE_PINE.rsi)
    expect(d.inputs.len).toBe(14)
    const r = backtest(d, candles)
    expect(r.signals.length).toBeGreaterThan(0)
    expect(r.mode).toBe('paper')
  })
  it('long/short with and/not/parens reverses positions', () => {
    const r = backtest(parsePine(SAMPLE_PINE.smaLongShort), candles)
    expect(new Set(r.trades.map((t) => t.direction))).toEqual(new Set(['long', 'short']))
  })
  it.each([
    ['ta.macd', 'strategy("x")\nm = ta.macd(close, 12, 26, 9)\nstrategy.entry("L", strategy.long)'],
    ['history', 'strategy("x")\nc = close[1]\nstrategy.entry("L", strategy.long)'],
    ['var', 'strategy("x")\nvar x = 1\nstrategy.entry("L", strategy.long)'],
    ['indicator', 'indicator("x")'],
    ['no strategy', 'x = 1'],
    ['request.security', 'strategy("x")\nh = request.security("BTC", "D", close)\nstrategy.entry("L", strategy.long)'],
  ])('rejects unsupported: %s', (_n, src) => {
    expect(() => parsePine(src)).toThrow(PineParseError)
  })
})

describe('converter', () => {
  it('uses parser, AI disabled by default', async () => {
    expect((await convertPine(SAMPLE_PINE.emaCross)).via).toBe('parser')
    const bad = await convertPine('strategy("x")\nm = ta.macd(close)\n')
    expect(bad.ok).toBe(false)
  })
  it('AI fallback output is validated (malicious output rejected)', async () => {
    const evil: AiConverter = { name: 'fake', convert: async () => ({ version: 1, name: 'x', inputs: {}, vars: [], rules: [{ action: 'entry', id: 'L', direction: 'long', when: { type: 'js', code: 'fetch()' } }] }) }
    const r = await convertPine('strategy("x")\nm = ta.macd(close)\n', evil)
    expect(r.ok).toBe(false)
    const good: AiConverter = { name: 'fake', convert: async () => parsePine(SAMPLE_PINE.rsi) }
    const r2 = await convertPine('strategy("x")\nm = ta.macd(close)\n', good)
    expect(r2.ok && r2.via).toBe('ai')
  })
})
