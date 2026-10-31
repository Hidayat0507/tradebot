/**
 * Manual eval against a real provider (costs money; never run in CI):
 *   PINE_AI_CONVERTER=on PINE_AI_API_KEY=... npx tsx scripts/pine-ai-eval.ts
 * The key is read from env only and never printed.
 */
import { getAiConverter } from '../src/lib/strategy/ai-converter'
import { DisabledAiConverter } from '../src/lib/strategy/converter'
import { runEval } from '../src/lib/strategy/ai-eval/run-eval'

const ai = getAiConverter()
if (ai instanceof DisabledAiConverter) {
  console.error('AI converter disabled: set PINE_AI_CONVERTER=on and PINE_AI_API_KEY')
  process.exit(1)
}
runEval(ai).then(({ score, results }) => {
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.detail}`)
  console.log(`score: ${(score * 100).toFixed(0)}%`)
  process.exit(score >= 0.8 ? 0 : 1)
})
