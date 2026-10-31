import { LIMITS, SOURCES, type BinOp, type Expr, type Rule, type StrategyDefinition } from '../types'
import { validateDefinition } from '../validate'

export class PineParseError extends Error {
  constructor(message: string, public line?: number) {
    super(line ? `line ${line}: ${message}` : message)
  }
}

type Tok = { k: 'num' | 'id' | 'str' | 'op'; v: string }

function tokenize(s: string, line: number): Tok[] {
  const out: Tok[] = []
  const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_.]*)|"([^"]*)"|'([^']*)'|(>=|<=|==|!=|:=|[-+*/()<>=,\[\]]))/y
  let i = 0
  while (i < s.length) {
    if (/^\s*$/.test(s.slice(i))) break
    re.lastIndex = i
    const m = re.exec(s)
    if (!m) throw new PineParseError(`unexpected input "${s.slice(i).trim().slice(0, 20)}"`, line)
    i = re.lastIndex
    if (m[1] !== undefined) out.push({ k: 'num', v: m[1] })
    else if (m[2] !== undefined) out.push({ k: 'id', v: m[2] })
    else if (m[3] !== undefined || m[4] !== undefined) out.push({ k: 'str', v: m[3] ?? m[4] })
    else out.push({ k: 'op', v: m[5] })
  }
  return out
}

class P {
  i = 0
  constructor(public t: Tok[], public line: number) {}
  peek(v?: string) { const x = this.t[this.i]; return x && (v === undefined || x.v === v) ? x : undefined }
  next() { const x = this.t[this.i++]; if (!x) this.err('unexpected end of line'); return x }
  eat(v: string) { const x = this.next(); if (x.v !== v) this.err(`expected "${v}" got "${x.v}"`); return x }
  done() { return this.i >= this.t.length }
  err(m: string): never { throw new PineParseError(m, this.line) }

  expr(): Expr { return this.bin(0) }
  static LEVELS: string[][] = [['or'], ['and'], ['==', '!='], ['>', '<', '>=', '<='], ['+', '-'], ['*', '/']]
  bin(level: number): Expr {
    if (level >= P.LEVELS.length) return this.unary()
    let left = this.bin(level + 1)
    while (this.peek() && P.LEVELS[level].includes(this.peek()!.v) && this.peek()!.k !== 'str') {
      const op = this.next().v as BinOp
      left = { type: 'bin', op, left, right: this.bin(level + 1) }
    }
    return left
  }
  unary(): Expr {
    if (this.peek('not')) { this.next(); return { type: 'not', arg: this.unary() } }
    if (this.peek('-')) { this.next(); return { type: 'neg', arg: this.unary() } }
    return this.primary()
  }
  primary(): Expr {
    const x = this.next()
    if (x.k === 'num') return { type: 'num', value: Number(x.v) }
    if (x.k === 'op' && x.v === '(') { const e = this.expr(); this.eat(')'); return e }
    if (x.k !== 'id') this.err(`unexpected "${x.v}"`)
    if (x.v === 'true' || x.v === 'false') return { type: 'bool', value: x.v === 'true' }
    if (this.peek('(')) {
      const fn = x.v.replace(/^ta\./, '')
      if (!x.v.startsWith('ta.') || !['sma', 'ema', 'rsi', 'crossover', 'crossunder'].includes(fn))
        this.err(`unsupported function ${x.v}`)
      const args = this.args().pos
      return { type: 'call', fn: fn as never, args }
    }
    if (this.peek('[')) this.err('history reference [] not supported')
    if ((SOURCES as readonly string[]).includes(x.v)) return { type: 'src', name: x.v as never }
    if (x.v.includes('.')) this.err(`unsupported identifier ${x.v}`)
    return { type: 'ref', name: x.v }
  }
  /** Parses "( a, b, key=c )" returning positional exprs/raw tokens and named exprs. */
  args(): { pos: Expr[]; raw: Tok[][]; named: Record<string, Expr> } {
    this.eat('(')
    const pos: Expr[] = [], raw: Tok[][] = [], named: Record<string, Expr> = {}
    if (this.peek(')')) { this.next(); return { pos, raw, named } }
    for (;;) {
      if (this.peek()?.k === 'id' && this.t[this.i + 1]?.v === '=') {
        const key = this.next().v; this.next(); named[key] = this.expr()
      } else if (this.peek()?.k === 'str' || this.peek('strategy.long') || this.peek('strategy.short')) {
        raw.push([this.next()]); pos.push({ type: 'num', value: NaN })
      } else {
        const start = this.i; pos.push(this.expr()); raw.push(this.t.slice(start, this.i))
      }
      if (this.peek(')')) { this.next(); break }
      this.eat(',')
    }
    return { pos, raw, named }
  }
}

/** Deterministic parser for the supported Pine v5 subset (see docs/pine-independence.md). */
export function parsePine(source: string): StrategyDefinition {
  if (source.length > LIMITS.maxSourceBytes) throw new PineParseError('source too large')
  let name = 'Pine strategy'
  let sawStrategy = false
  const inputs: Record<string, number> = {}
  const vars: { name: string; expr: Expr }[] = []
  const rules: Rule[] = []
  let block: { cond: Expr; indent: number } | null = null

  const lines = source.split(/\r?\n/)
  lines.forEach((rawLine, idx) => {
    const ln = idx + 1
    const noComment = rawLine.replace(/\/\/.*$/, '')
    if (!noComment.trim()) return
    const indent = noComment.match(/^\s*/)![0].replace(/\t/g, '    ').length
    if (block && indent <= block.indent) block = null
    if (indent > 0 && !block) throw new PineParseError('unexpected indentation', ln)
    const toks = tokenize(noComment, ln)
    const p = new P(toks, ln)
    const head = toks[0]

    if (head.v === 'strategy') {
      p.next()
      const a = p.args()
      if (a.raw[0]?.[0]?.k === 'str') name = a.raw[0][0].v
      sawStrategy = true
      return
    }
    if (head.v === 'indicator') throw new PineParseError('indicator scripts are not strategies', ln)
    if (head.v === 'if') {
      if (block) throw new PineParseError('nested if not supported', ln)
      p.next()
      const cond = p.expr()
      if (!p.done()) throw new PineParseError('expected end of if condition', ln)
      block = { cond, indent }
      return
    }
    if (head.v.startsWith('strategy.')) {
      p.next()
      const a = p.args()
      if (!p.done()) p.err('trailing tokens')
      let when: Expr = a.named.when ?? { type: 'bool', value: true }
      if (block) when = a.named.when ? { type: 'bin', op: 'and', left: block.cond, right: when } : block.cond
      const id = a.raw[0]?.[0]?.k === 'str' ? a.raw[0][0].v : undefined
      if (head.v === 'strategy.entry') {
        const dir = a.raw[1]?.map((t) => t.v).join('')
        if (!id || (dir !== 'strategy.long' && dir !== 'strategy.short')) p.err('strategy.entry(id, strategy.long|strategy.short) expected')
        rules.push({ action: 'entry', id: id!, direction: dir === 'strategy.long' ? 'long' : 'short', when })
      } else if (head.v === 'strategy.close') {
        if (!id) p.err('strategy.close(id) expected')
        rules.push({ action: 'close', id: id!, when })
      } else if (head.v === 'strategy.close_all') {
        rules.push({ action: 'close_all', id: '*', when })
      } else p.err(`unsupported call ${head.v}`)
      return
    }
    if (block) throw new PineParseError('only strategy.entry/close allowed inside if', ln)
    if (head.v === 'var' || toks.some((t) => t.v === ':=')) throw new PineParseError('var / := not supported', ln)
    if (head.k === 'id' && toks[1]?.v === '=') {
      p.next(); p.next()
      const varName = head.v
      if (p.peek()?.v === 'input' || p.peek()?.v.startsWith('input.')) {
        const fn = p.next().v
        if (!['input', 'input.int', 'input.float'].includes(fn)) p.err(`unsupported ${fn}`)
        const a = p.args()
        const def = a.named.defval ?? a.pos[0]
        if (!def || def.type !== 'num') p.err('input default must be a number')
        inputs[varName] = (def as { value: number }).value
      } else {
        vars.push({ name: varName, expr: p.expr() })
      }
      if (!p.done()) p.err('trailing tokens')
      return
    }
    throw new PineParseError(`unsupported statement "${noComment.trim().slice(0, 40)}"`, ln)
  })
  if (!sawStrategy) throw new PineParseError('missing strategy(...) declaration')
  if (!rules.length) throw new PineParseError('no strategy.entry / strategy.close found')
  try {
    return validateDefinition({ version: 1, name, inputs, vars, rules })
  } catch (e) {
    throw new PineParseError((e as Error).message)
  }
}
