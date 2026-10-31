import { describe, expect, it, vi } from 'vitest'
import { getAiConverter, OpenAiCompatibleConverter, parseAiJson } from '@/lib/strategy/ai-converter'
import { DisabledAiConverter, convertPine } from '@/lib/strategy/converter'
import { parsePine } from '@/lib/strategy/pine/parser'
import { EVAL_CASES } from '@/lib/strategy/ai-eval/cases'
import { runEval } from '@/lib/strategy/ai-eval/run-eval'

const KEY = 'sk-test-DO-NOT-LEAK-123'
const reply = (content: string, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status }))
const on = (f: typeof fetch) => getAiConverter({ PINE_AI_CONVERTER: 'on', PINE_AI_API_KEY: KEY }, f)
const UNSUPPORTED = EVAL_CASES.find((c) => c.id === 'v4-no-namespace')!

describe('server flag', () => {
  it('off by default; needs both flag and key from env', () => {
    expect(getAiConverter({})).toBeInstanceOf(DisabledAiConverter)
    expect(getAiConverter({ PINE_AI_CONVERTER: 'on' })).toBeInstanceOf(DisabledAiConverter)
    expect(getAiConverter({ PINE_AI_API_KEY: KEY })).toBeInstanceOf(DisabledAiConverter)
    expect(getAiConverter({ PINE_AI_CONVERTER: 'true', PINE_AI_API_KEY: KEY })).toBeInstanceOf(DisabledAiConverter)
    expect(on(vi.fn())).toBeInstanceOf(OpenAiCompatibleConverter)
  })
  it('default process.env in tests is off', () => expect(getAiConverter()).toBeInstanceOf(DisabledAiConverter))
})

describe('OpenAiCompatibleConverter (mocked fetch)', () => {
  it('only called when parser fails; sends key as bearer; output validated', async () => {
    const f = reply(JSON.stringify(parsePine(UNSUPPORTED.reference!)))
    expect((await convertPine(UNSUPPORTED.reference!, on(f))).via).toBe('parser')
    expect(f).not.toHaveBeenCalled()
    const r = await convertPine(UNSUPPORTED.pine, on(f))
    expect(r.ok && r.via).toBe('ai')
    expect(r.ok && r.warnings[0]).toMatch(/Review carefully/)
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(JSON.parse(init.body).temperature).toBe(0)
  })
  it.each([
    ['malicious node', JSON.stringify({ version: 1, name: 'x', inputs: {}, vars: [], rules: [{ action: 'entry', id: 'L', direction: 'long', when: { type: 'js', code: 'process.exit()' } }] })],
    ['unknown fn', JSON.stringify({ version: 1, name: 'x', inputs: {}, vars: [{ name: 'v', expr: { type: 'call', fn: 'eval', args: [] } }], rules: [] })],
    ['not json', 'Sure! Here is your strategy: ...'],
    ['declined', '{"error":"uses request.security"}'],
    ['huge length', JSON.stringify({ version: 1, name: 'x', inputs: {}, vars: [{ name: 'v', expr: { type: 'call', fn: 'sma', args: [{ type: 'src', name: 'close' }, { type: 'num', value: 1e9 }] } }], rules: [{ action: 'entry', id: 'L', direction: 'long', when: { type: 'bool', value: true } }] })],
  ])('rejects %s', async (_n, content) => {
    const r = await convertPine(UNSUPPORTED.pine, on(reply(content)))
    expect(r.ok).toBe(false)
  })
  it('HTTP errors / network errors / timeouts never leak the key', async () => {
    for (const f of [
      reply('', 401),
      vi.fn().mockRejectedValue(new Error(`connect failed ${KEY}`)),
      vi.fn((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))))),
    ]) {
      const ai = new OpenAiCompatibleConverter({ apiKey: KEY, baseUrl: 'https://x/v1', model: 'm', timeoutMs: 20, fetch: f as never })
      const r = await convertPine(UNSUPPORTED.pine, ai)
      expect(r.ok).toBe(false)
      expect(JSON.stringify(r)).not.toContain(KEY)
    }
  })
  it('parseAiJson tolerates code fences', () => {
    expect(parseAiJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })
})

describe('eval set', () => {
  it('every reference parses and every case needs the AI (parser fails)', () => {
    for (const c of EVAL_CASES) {
      expect(() => parsePine(c.pine), c.id).toThrow()
      if (c.reference) expect(() => parsePine(c.reference!), c.id).not.toThrow()
    }
  })
  it('perfect (mocked) model scores 100%', async () => {
    const byPine = new Map(EVAL_CASES.map((c) => [c.pine, c]))
    const perfect = {
      name: 'mock-perfect',
      convert: async (pine: string) => {
        const c = byPine.get(pine)!
        if (c.reject) throw new Error('declined')
        return parsePine(c.reference!)
      },
    }
    const { score, results } = await runEval(perfect)
    expect(results.filter((r) => !r.pass)).toEqual([])
    expect(score).toBe(1)
  })
  it('sloppy (mocked) model is caught: wrong semantics + accepting rejects', async () => {
    const sloppy = { name: 'mock-sloppy', convert: async () => parsePine(EVAL_CASES[0].reference!) }
    const { score, results } = await runEval(sloppy)
    expect(results.find((r) => r.id === 'v4-no-namespace')!.pass).toBe(true)
    expect(results.find((r) => r.id === 'if-else')!.detail).toBe('signals differ from reference')
    expect(results.find((r) => r.id === 'reject-vwap')!.pass).toBe(false)
    expect(score).toBeLessThan(0.3)
  })
})
