import { describe, expect, it } from 'vitest'
import { friendlyPineError, SUPPORTED_PINE } from '@/lib/strategy/friendly-error'
import { convertPine } from '@/lib/strategy/converter'
import { readFileSync } from 'fs'
import path from 'path'

const err = async (pine: string) => {
  const r = await convertPine(pine)
  if (r.ok) throw new Error('expected failure')
  return friendlyPineError(r.error, pine)
}

describe('friendly Pine errors (real parser messages)', () => {
  it.each([
    ['strategy("x")\nv = ta.vwap(close)\nstrategy.entry("L", strategy.long)', /ta\.vwap isn't supported yet/, 2, 'v = ta.vwap(close)'],
    ['strategy("x")\nm = ta.macd(close, 12, 26, 9)\nstrategy.entry("L", strategy.long)', /tuple/, 2, undefined],
    ['indicator("x")', /indicator, not a strategy/, 1, undefined],
    ['x = 1', /No strategy\(\.\.\.\) line/, undefined, undefined],
    ['strategy("x")\nx = 1', /No entries/, undefined, undefined],
    ['strategy("x")\nvar x = 1\nstrategy.entry("L", strategy.long)', /var and :=/, 2, undefined],
    ['strategy("x")\nd = request.security("A", "D", close)\nstrategy.entry("L", strategy.long)', /request\.security isn't supported/, 2, undefined],
    ['strategy("x")\nstrategy.entry("L", strategy.long)\nstrategy.exit("X", "L", profit = 10)', /needs price levels/, 3, undefined],
  ])('%s', async (pine, title, line, lineText) => {
    const f = await err(pine)
    expect(f.title).toMatch(title)
    expect(f.line).toBe(line)
    if (lineText) expect(f.lineText).toBe(lineText)
    expect(f.hint.length).toBeGreaterThan(10)
  })
  it('HTTP statuses', () => {
    expect(friendlyPineError('x', '', 401).title).toMatch(/signed out/)
    expect(friendlyPineError('x', '', 500).title).toMatch(/our side/)
  })
})

describe('/strategy page P1', () => {
  const page = readFileSync(path.resolve(__dirname, '../app/strategy/page.tsx'), 'utf8')
  it('uses the shared supported list (no stale hint) and friendly errors', () => {
    expect(page).toMatch(/SUPPORTED_PINE/)
    expect(page).toMatch(/friendlyPineError/)
    expect(page).not.toMatch(/Supported: ta\.sma\/ema\/rsi\/crossover\/crossunder, strategy\.entry\/close\./)
  })
  it('form controls have dark-theme text/background classes', () => {
    for (const tag of ['<textarea', '<select', '<input']) {
      const chunks = page.split(tag).slice(1)
      expect(chunks.length).toBeGreaterThan(0)
      for (const c of chunks) if (!c.startsWith(' type="checkbox"')) expect(c.slice(0, 400)).toMatch(/FIELD/)
    }
  })
  it('nav links to /strategy', () => {
    const nav = readFileSync(path.resolve(__dirname, '../components/Navigation.tsx'), 'utf8')
    expect(nav).toMatch(/<NavLink href="\/strategy">/)
  })
  it('hint covers every supported indicator', () => {
    expect(SUPPORTED_PINE.indicators).toEqual(expect.arrayContaining(['ta.atr', 'ta.macd']))
  })
})
