import { describe, expect, it } from 'vitest'
import { describeExpr, describeStrategy } from '@/lib/strategy/describe'
import { parsePine } from '@/lib/strategy/pine/parser'
import { SAMPLE_PINE } from '@/lib/strategy/samples'
import type { Expr, StrategyDefinition } from '@/lib/strategy/types'

const def = (over: Partial<StrategyDefinition> = {}): StrategyDefinition => ({
  version: 1,
  name: 't',
  inputs: {},
  vars: [],
  rules: [],
  ...over,
})
const close: Expr = { type: 'src', name: 'close' }
const num = (value: number): Expr => ({ type: 'num', value })

describe('describeExpr', () => {
  it('renders literals and sources', () => {
    const d = def()
    expect(describeExpr(num(9), d)).toBe('9')
    expect(describeExpr({ type: 'bool', value: true }, d)).toBe('true')
    expect(describeExpr({ type: 'bool', value: false }, d)).toBe('false')
    expect(describeExpr(close, d)).toBe('close')
  })

  it('inlines refs to inputs as their numeric value', () => {
    const d = def({ inputs: { len: 20 } })
    expect(describeExpr({ type: 'ref', name: 'len' }, d)).toBe('20')
  })

  it('inlines refs to earlier vars', () => {
    const d = def({ vars: [{ name: 'fast', expr: { type: 'call', fn: 'ema', args: [close, num(9)] } }] })
    expect(describeExpr({ type: 'ref', name: 'fast' }, d)).toBe('EMA(close, 9)')
  })

  it('falls back to the bare name for an unresolved ref', () => {
    expect(describeExpr({ type: 'ref', name: 'mystery' }, def())).toBe('mystery')
  })

  it.each([
    ['sma', 'SMA(close, 10)'],
    ['ema', 'EMA(close, 10)'],
    ['rsi', 'RSI(close, 10)'],
  ] as const)('renders %s(series, len)', (fn, expected) => {
    expect(describeExpr({ type: 'call', fn, args: [close, num(10)] }, def())).toBe(expected)
  })

  it('renders atr(len)', () => {
    expect(describeExpr({ type: 'call', fn: 'atr', args: [num(14)] }, def())).toBe('ATR(14)')
  })

  it.each([
    ['macd', 'MACD(close, 12, 26, 9) line'],
    ['macd_signal', 'MACD(close, 12, 26, 9) signal'],
    ['macd_hist', 'MACD(close, 12, 26, 9) histogram'],
  ] as const)('renders %s with a readable suffix', (fn, expected) => {
    expect(describeExpr({ type: 'call', fn, args: [close, num(12), num(26), num(9)] }, def())).toBe(expected)
  })

  it('renders crossover/crossunder as English, not a function call', () => {
    const a: Expr = { type: 'ref', name: 'fast' }
    const b: Expr = { type: 'ref', name: 'slow' }
    expect(describeExpr({ type: 'call', fn: 'crossover', args: [a, b] }, def())).toBe('fast crosses above slow')
    expect(describeExpr({ type: 'call', fn: 'crossunder', args: [a, b] }, def())).toBe('fast crosses below slow')
  })

  it.each(['+', '-', '*', '/', '>', '<', '>=', '<=', '==', '!=', 'and', 'or'] as const)('renders bin op %s', (op) => {
    expect(describeExpr({ type: 'bin', op, left: close, right: num(1) }, def())).toBe(`close ${op} 1`)
  })

  it('wraps nested bin expressions in parens but leaves leaves bare', () => {
    const nested: Expr = { type: 'bin', op: '-', left: num(1), right: num(0.02) }
    const e: Expr = { type: 'bin', op: '*', left: close, right: nested }
    expect(describeExpr(e, def())).toBe('close * (1 - 0.02)')
  })

  it('renders not/neg', () => {
    expect(describeExpr({ type: 'not', arg: { type: 'bin', op: '<', left: close, right: num(0) } }, def())).toBe('not (close < 0)')
    expect(describeExpr({ type: 'neg', arg: num(5) }, def())).toBe('-5')
  })

  it('renders history offsets in Pine bracket style', () => {
    expect(describeExpr({ type: 'hist', arg: close, offset: 3 }, def())).toBe('close[3]')
  })
})

describe('describeStrategy (rules)', () => {
  it('describes entry/close with an id and omits "when true"', () => {
    const d = def({
      rules: [
        { action: 'entry', id: 'L', direction: 'long', when: { type: 'bin', op: '>', left: close, right: num(100) } },
        { action: 'close', id: 'L', when: { type: 'bool', value: true } },
      ],
    })
    expect(describeStrategy(d)).toEqual(['Enter long ("L") when close > 100', 'Close "L"'])
  })

  it('describes close_all', () => {
    const d = def({ rules: [{ action: 'close_all', id: '*', when: { type: 'bin', op: '<', left: close, right: num(50) } }] })
    expect(describeStrategy(d)).toEqual(['Close all positions when close < 50'])
  })

  it('describes exit with fromEntry, stop and limit', () => {
    const d = def({
      rules: [{
        action: 'exit', id: 'XL', fromEntry: 'L', when: { type: 'bool', value: true },
        stop: { type: 'bin', op: '*', left: close, right: num(0.98) },
        limit: { type: 'bin', op: '*', left: close, right: num(1.04) },
      }],
    })
    expect(describeStrategy(d)).toEqual(['Exit "XL" (protects "L") with stop at close * 0.98 and limit at close * 1.04'])
  })

  it('every sample strategy renders without throwing and produces one line per rule', () => {
    for (const pine of Object.values(SAMPLE_PINE)) {
      const parsed = parsePine(pine)
      const lines = describeStrategy(parsed)
      expect(lines).toHaveLength(parsed.rules.length)
      for (const l of lines) expect(l.length).toBeGreaterThan(0)
    }
  })

  it('EMA cross sample reads as a single self-contained sentence per rule (inputs/vars inlined)', () => {
    const parsed = parsePine(SAMPLE_PINE.emaCross)
    expect(describeStrategy(parsed)).toEqual([
      'Enter long ("Long") when EMA(close, 9) crosses above EMA(close, 21)',
      'Close "Long" when EMA(close, 9) crosses below EMA(close, 21)',
    ])
  })

  it('MACD + ATR sample inlines macd/atr vars into the exit stop/limit', () => {
    const parsed = parsePine(SAMPLE_PINE.macdAtrStops)
    const lines = describeStrategy(parsed)
    expect(lines[0]).toBe('Enter long ("Long") when MACD(close, 12, 26, 9) line crosses above MACD(close, 12, 26, 9) signal and (MACD(close, 12, 26, 9) histogram[1] < 0)')
    expect(lines[1]).toBe('Exit "XL" (protects "Long") with stop at close - (2 * ATR(14)) and limit at close + (3 * ATR(14))')
    expect(lines[2]).toBe('Close "Long" when MACD(close, 12, 26, 9) line crosses below MACD(close, 12, 26, 9) signal')
  })
})
