import { describe, expect, it } from 'vitest'
import { ema, rsi, sma, crossover } from '@/lib/strategy/indicators'
import { evaluate } from '@/lib/strategy/runtime'
import { backtest } from '@/lib/strategy/backtest'
import { sampleCandles } from '@/lib/strategy/sample-candles'
import { validateDefinition } from '@/lib/strategy/validate'
import type { StrategyDefinition } from '@/lib/strategy/types'

const emaCross: StrategyDefinition = {
  version: 1, name: 'EMA cross', inputs: { fastLen: 9, slowLen: 21 },
  vars: [
    { name: 'fast', expr: { type: 'call', fn: 'ema', args: [{ type: 'src', name: 'close' }, { type: 'ref', name: 'fastLen' }] } },
    { name: 'slow', expr: { type: 'call', fn: 'ema', args: [{ type: 'src', name: 'close' }, { type: 'ref', name: 'slowLen' }] } },
  ],
  rules: [
    { action: 'entry', id: 'Long', direction: 'long', when: { type: 'call', fn: 'crossover', args: [{ type: 'ref', name: 'fast' }, { type: 'ref', name: 'slow' }] } },
    { action: 'close', id: 'Long', when: { type: 'call', fn: 'crossunder', args: [{ type: 'ref', name: 'fast' }, { type: 'ref', name: 'slow' }] } },
  ],
}

describe('indicators', () => {
  it('sma', () => expect(sma([1, 2, 3, 4], 2)).toEqual([NaN, 1.5, 2.5, 3.5]))
  it('ema seeds with sma', () => {
    const e = ema([1, 2, 3, 4], 3)
    expect(e[2]).toBe(2)
    expect(e[3]).toBe(0.5 * 4 + 0.5 * 2)
  })
  it('rsi is 100 on monotonic rise and bounded', () => {
    expect(rsi([1, 2, 3, 4, 5, 6], 3).slice(3)).toEqual([100, 100, 100])
    const r = rsi(sampleCandles(200).map((c) => c.close), 14).filter((v) => !Number.isNaN(v))
    expect(r.every((v) => v >= 0 && v <= 100)).toBe(true)
  })
  it('crossover', () => expect(crossover([1, 3, 4], [2, 2, 5])).toEqual([0, 1, 0]))
})

describe('runtime', () => {
  const candles = sampleCandles(300)
  it('is pure and deterministic', () => {
    const a = evaluate(emaCross, candles)
    expect(evaluate(emaCross, candles)).toEqual(a)
    expect(a.length).toBeGreaterThan(2)
    expect(a.some((s) => s.action === 'entry')).toBe(true)
    expect(a.some((s) => s.action === 'close')).toBe(true)
  })
  it('rejects unknown nodes / functions (sandbox)', () => {
    const bad = { ...emaCross, vars: [{ name: 'x', expr: { type: 'call', fn: 'eval', args: [] } }] }
    expect(() => validateDefinition(bad)).toThrow(/unknown function/)
    expect(() => validateDefinition({ ...emaCross, rules: [{ ...emaCross.rules[0], when: { type: 'js', code: 'process.exit()' } }] })).toThrow()
    expect(() => validateDefinition({ ...emaCross, inputs: { fastLen: 1e9, slowLen: 21 } })).toThrow(/length/)
  })
  it('backtest is paper, with closed trades', () => {
    const r = backtest(emaCross, candles)
    expect(r.mode).toBe('paper')
    expect(r.trades.length).toBeGreaterThan(0)
    for (const t of r.trades) expect(t.entryTime).toBeLessThanOrEqual(t.exitTime)
  })
})
