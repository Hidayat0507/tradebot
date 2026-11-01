import type { Expr, FuncName, Rule, StrategyDefinition } from './types'

const FUNC_LABEL: Record<FuncName, string> = {
  sma: 'SMA',
  ema: 'EMA',
  rsi: 'RSI',
  atr: 'ATR',
  macd: 'MACD',
  macd_signal: 'MACD',
  macd_hist: 'MACD',
  crossover: 'crosses above',
  crossunder: 'crosses below',
}

function resolveRef(name: string, def: StrategyDefinition): Expr | undefined {
  if (name in def.inputs) return { type: 'num', value: def.inputs[name] }
  return def.vars.find((v) => v.name === name)?.expr
}

function wrap(e: Expr, def: StrategyDefinition): string {
  const s = describeExpr(e, def)
  return e.type === 'bin' ? `(${s})` : s
}

/** Renders one expression as an English fragment. Refs to inputs/vars are inlined so the
 * result is a standalone, self-contained sentence (no need to cross-reference other lines). */
export function describeExpr(e: Expr, def: StrategyDefinition): string {
  switch (e.type) {
    case 'num':
      return String(e.value)
    case 'bool':
      return e.value ? 'true' : 'false'
    case 'src':
      return e.name
    case 'ref': {
      const resolved = resolveRef(e.name, def)
      return resolved ? describeExpr(resolved, def) : e.name
    }
    case 'neg':
      return `-${wrap(e.arg, def)}`
    case 'not':
      return `not ${wrap(e.arg, def)}`
    case 'hist':
      return `${describeExpr(e.arg, def)}[${e.offset}]`
    case 'call': {
      const args = e.args.map((a) => describeExpr(a, def))
      if (e.fn === 'crossover' || e.fn === 'crossunder') return `${args[0]} ${FUNC_LABEL[e.fn]} ${args[1]}`
      const suffix = e.fn === 'macd_signal' ? ' signal' : e.fn === 'macd_hist' ? ' histogram' : e.fn === 'macd' ? ' line' : ''
      return `${FUNC_LABEL[e.fn]}(${args.join(', ')})${suffix}`
    }
    case 'bin':
      return `${wrap(e.left, def)} ${e.op} ${wrap(e.right, def)}`
  }
}

function describeRule(r: Rule, def: StrategyDefinition): string {
  const always = r.when.type === 'bool' && r.when.value === true
  const cond = always ? '' : ` when ${describeExpr(r.when, def)}`
  switch (r.action) {
    case 'entry':
      return `Enter ${r.direction} ("${r.id}")${cond}`
    case 'close':
      return `Close "${r.id}"${cond}`
    case 'close_all':
      return `Close all positions${cond}`
    case 'exit': {
      const parts: string[] = []
      if (r.stop) parts.push(`stop at ${describeExpr(r.stop, def)}`)
      if (r.limit) parts.push(`limit at ${describeExpr(r.limit, def)}`)
      const target = r.fromEntry ? ` (protects "${r.fromEntry}")` : ''
      return `Exit "${r.id}"${target} with ${parts.join(' and ')}${cond}`
    }
  }
}

/** Plain-English rendering of a validated strategy, one sentence per rule, for the conversion
 * review UI (used for both parser and AI output). */
export function describeStrategy(def: StrategyDefinition): string[] {
  return def.rules.map((r) => describeRule(r, def))
}
