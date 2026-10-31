import { BIN_OPS, FUNCS, LIMITS, SOURCES, type Expr, type StrategyDefinition } from './types'

export class StrategyValidationError extends Error {}

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/

/** Strictly validates untrusted definitions (parser or AI output). Returns a normalized copy. */
export function validateDefinition(input: unknown): StrategyDefinition {
  const fail = (m: string): never => { throw new StrategyValidationError(m) }
  if (!input || typeof input !== 'object') fail('definition must be an object')
  const d = input as Record<string, unknown>
  if (d.version !== 1) fail('unsupported version')
  const name = typeof d.name === 'string' ? d.name.slice(0, 100) : 'Strategy'
  const inputs: Record<string, number> = {}
  const known = new Set<string>()
  if (!d.inputs || typeof d.inputs !== 'object') fail('inputs must be an object')
  for (const [k, v] of Object.entries(d.inputs as object)) {
    if (!NAME.test(k)) fail(`bad input name ${k}`)
    if (typeof v !== 'number' || !Number.isFinite(v)) fail(`input ${k} must be a finite number`)
    inputs[k] = v as number
    known.add(k)
  }
  let nodes = 0
  const checkExpr = (e: unknown): Expr => {
    if (++nodes > LIMITS.maxNodes) fail('definition too large')
    if (!e || typeof e !== 'object') fail('bad expression')
    const x = e as Record<string, unknown>
    switch (x.type) {
      case 'num':
        if (typeof x.value !== 'number' || !Number.isFinite(x.value)) fail('bad number')
        return { type: 'num', value: x.value as number }
      case 'bool':
        if (typeof x.value !== 'boolean') fail('bad bool')
        return { type: 'bool', value: x.value as boolean }
      case 'src':
        if (!SOURCES.includes(x.name as never)) fail(`unknown source ${String(x.name)}`)
        return { type: 'src', name: x.name as never }
      case 'ref':
        if (typeof x.name !== 'string' || !known.has(x.name)) fail(`unknown reference ${String(x.name)}`)
        return { type: 'ref', name: x.name as string }
      case 'not':
      case 'neg':
        return { type: x.type, arg: checkExpr(x.arg) }
      case 'bin':
        if (!BIN_OPS.includes(x.op as never)) fail(`unknown operator ${String(x.op)}`)
        return { type: 'bin', op: x.op as never, left: checkExpr(x.left), right: checkExpr(x.right) }
      case 'call': {
        if (!FUNCS.includes(x.fn as never)) fail(`unknown function ${String(x.fn)}`)
        if (!Array.isArray(x.args) || x.args.length !== 2) fail(`${String(x.fn)} takes 2 arguments`)
        const args = (x.args as unknown[]).map(checkExpr)
        if (x.fn === 'sma' || x.fn === 'ema' || x.fn === 'rsi') {
          const len = constValue(args[1], inputs)
          if (len === undefined || !Number.isInteger(len) || len < 1 || len > LIMITS.maxLength)
            fail(`${String(x.fn)} length must be a constant integer 1..${LIMITS.maxLength}`)
        }
        return { type: 'call', fn: x.fn as never, args }
      }
      default:
        return fail(`unknown expression type ${String(x.type)}`)
    }
  }
  if (!Array.isArray(d.vars)) fail('vars must be an array')
  const vars = (d.vars as unknown[]).map((v) => {
    const o = v as Record<string, unknown>
    if (typeof o?.name !== 'string' || !NAME.test(o.name)) fail('bad var name')
    if (known.has(o.name as string)) fail(`duplicate name ${String(o.name)}`)
    const expr = checkExpr(o.expr)
    known.add(o.name as string)
    return { name: o.name as string, expr }
  })
  if (!Array.isArray(d.rules) || d.rules.length === 0) fail('at least one rule required')
  const rules = (d.rules as unknown[]).map((r) => {
    const o = r as Record<string, unknown>
    if (!['entry', 'close', 'close_all'].includes(o?.action as string)) fail('bad rule action')
    if (typeof o.id !== 'string' || o.id.length > 64) fail('bad rule id')
    if (o.action === 'entry' && o.direction !== 'long' && o.direction !== 'short') fail('entry needs direction')
    return {
      action: o.action as 'entry' | 'close' | 'close_all',
      id: o.id as string,
      ...(o.action === 'entry' ? { direction: o.direction as 'long' | 'short' } : {}),
      when: checkExpr(o.when),
    }
  })
  return { version: 1, name, inputs, vars, rules }
}

export function constValue(e: Expr, inputs: Record<string, number>): number | undefined {
  if (e.type === 'num') return e.value
  if (e.type === 'ref' && e.name in inputs) return inputs[e.name]
  if (e.type === 'neg') { const v = constValue(e.arg, inputs); return v === undefined ? v : -v }
  return undefined
}
