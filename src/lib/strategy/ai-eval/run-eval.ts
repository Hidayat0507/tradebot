import type { AiConverter } from '../converter'
import { convertPine } from '../converter'
import { parsePine } from '../pine/parser'
import { evaluate } from '../runtime'
import { sampleCandles } from '../sample-candles'
import { EVAL_CASES, type EvalCase } from './cases'

export interface EvalResult { id: string; pass: boolean; detail: string }

const CANDLE_SETS = [sampleCandles(400, 100, 1), sampleCandles(400, 50, 7), sampleCandles(400, 2000, 99)]
const key = (d: Parameters<typeof evaluate>[0]) =>
  CANDLE_SETS.map((c) => evaluate(d, c).map((s) => `${s.index}:${s.action}:${s.id}:${s.direction ?? ''}:${s.stop ?? ''}:${s.limit ?? ''}`).join(',')).join('|')

export async function runEval(ai: AiConverter, cases: EvalCase[] = EVAL_CASES): Promise<{ score: number; results: EvalResult[] }> {
  const results: EvalResult[] = []
  for (const c of cases) {
    let r
    try {
      r = await convertPine(c.pine, ai)
    } catch (e) {
      r = { ok: false as const, error: (e as Error).message, via: 'ai' as const }
    }
    if (c.reject) {
      results.push({ id: c.id, pass: !r.ok, detail: r.ok ? 'converted a script that should be rejected' : 'rejected' })
      continue
    }
    if (!r.ok) { results.push({ id: c.id, pass: false, detail: r.error.slice(0, 200) }); continue }
    const same = key(r.definition) === key(parsePine(c.reference!))
    results.push({ id: c.id, pass: same, detail: same ? `ok via ${r.via}` : 'signals differ from reference' })
  }
  return { score: results.filter((x) => x.pass).length / results.length, results }
}
