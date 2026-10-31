import * as ta from './indicators'
import { LIMITS, type Candle, type Expr, type Signal, type StrategyDefinition } from './types'
import { constValue, validateDefinition } from './validate'

/**
 * Pure, sandboxed evaluation: walks a validated AST over candle arrays.
 * No eval, no I/O. Signals are generated on bar close.
 */
export function evaluate(definition: StrategyDefinition, candles: Candle[]): Signal[] {
  const def = validateDefinition(definition)
  if (candles.length > LIMITS.maxCandles) throw new Error(`too many candles (max ${LIMITS.maxCandles})`)
  const n = candles.length
  const env = new Map<string, number[]>()
  for (const [k, v] of Object.entries(def.inputs)) env.set(k, new Array(n).fill(v))
  const src = {
    open: candles.map((c) => c.open),
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    volume: candles.map((c) => c.volume),
    hl2: candles.map((c) => (c.high + c.low) / 2),
    hlc3: candles.map((c) => (c.high + c.low + c.close) / 3),
  }
  const truthy = (v: number) => !Number.isNaN(v) && v !== 0
  const ev = (e: Expr): number[] => {
    switch (e.type) {
      case 'num': return new Array(n).fill(e.value)
      case 'bool': return new Array(n).fill(e.value ? 1 : 0)
      case 'src': return src[e.name]
      case 'ref': return env.get(e.name)!
      case 'neg': return ev(e.arg).map((v) => -v)
      case 'not': return ev(e.arg).map((v) => (truthy(v) ? 0 : 1))
      case 'hist': return ta.shift(ev(e.arg), e.offset)
      case 'call': {
        const c = (k: number) => constValue(e.args[k], def.inputs)!
        if (e.fn === 'atr') return ta.atr(src.high, src.low, src.close, c(0))
        const a = ev(e.args[0])
        if (e.fn === 'crossover' || e.fn === 'crossunder') return ta[e.fn](a, ev(e.args[1]))
        if (e.fn === 'macd' || e.fn === 'macd_signal' || e.fn === 'macd_hist') {
          const m = ta.macd(a, c(1), c(2), c(3))
          return e.fn === 'macd' ? m.line : e.fn === 'macd_signal' ? m.signal : m.hist
        }
        return ta[e.fn](a, c(1))
      }
      case 'bin': {
        const l = ev(e.left), r = ev(e.right)
        return l.map((x, i) => binop(e.op, x, r[i], truthy))
      }
    }
  }
  for (const v of def.vars) env.set(v.name, ev(v.expr))
  const conds = def.rules.map((r) => ev(r.when))
  const stops = def.rules.map((r) => (r.stop ? ev(r.stop) : undefined))
  const limits = def.rules.map((r) => (r.limit ? ev(r.limit) : undefined))
  const signals: Signal[] = []
  for (let i = 0; i < n; i++) {
    def.rules.forEach((r, k) => {
      if (!truthy(conds[k][i])) return
      const s: Signal = { index: i, time: candles[i].time, action: r.action, id: r.id, direction: r.direction, price: candles[i].close }
      if (r.action === 'exit') {
        const stop = stops[k]?.[i], limit = limits[k]?.[i]
        if (r.fromEntry !== undefined) s.fromEntry = r.fromEntry
        if (stop !== undefined && Number.isFinite(stop)) s.stop = stop
        if (limit !== undefined && Number.isFinite(limit)) s.limit = limit
        if (s.stop === undefined && s.limit === undefined) return
      }
      signals.push(s)
    })
  }
  return signals
}

function binop(op: string, a: number, b: number, t: (v: number) => boolean): number {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? NaN : a / b
    case 'and': return t(a) && t(b) ? 1 : 0
    case 'or': return t(a) || t(b) ? 1 : 0
  }
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  switch (op) {
    case '>': return a > b ? 1 : 0
    case '<': return a < b ? 1 : 0
    case '>=': return a >= b ? 1 : 0
    case '<=': return a <= b ? 1 : 0
    case '==': return a === b ? 1 : 0
    case '!=': return a !== b ? 1 : 0
  }
  return NaN
}
