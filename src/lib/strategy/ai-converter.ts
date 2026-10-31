import type { AiConverter } from './converter'
import { DisabledAiConverter } from './converter'
import { LIMITS } from './types'

/**
 * OpenAI-compatible chat-completions converter. Server-only.
 * - Off unless PINE_AI_CONVERTER=on AND PINE_AI_API_KEY is set (env only; never from requests).
 * - Output is untrusted JSON: convertPine() always runs validateDefinition() on it.
 * - The key is never logged or included in errors.
 */
export interface AiConverterConfig {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
  fetch?: typeof fetch
}

export const SYSTEM_PROMPT = `You convert TradingView Pine Script v5 strategies into a JSON StrategyDefinition.
Reply with ONLY one JSON object, no prose, no code fences. Schema:
{ "version": 1, "name": string, "inputs": { [name]: number },
  "vars": [ { "name": string, "expr": Expr } ],
  "rules": [ { "action": "entry"|"close"|"close_all"|"exit", "id": string, "direction"?: "long"|"short",
               "fromEntry"?: string, "stop"?: Expr, "limit"?: Expr, "when": Expr } ] }
Expr is one of:
 {"type":"num","value":number} | {"type":"bool","value":boolean}
 {"type":"src","name":"open"|"high"|"low"|"close"|"volume"|"hl2"|"hlc3"}
 {"type":"ref","name":string}  (an input or an earlier var)
 {"type":"call","fn":"sma"|"ema"|"rsi","args":[series, length]}
 {"type":"call","fn":"crossover"|"crossunder","args":[a, b]}
 {"type":"call","fn":"atr","args":[length]}
 {"type":"call","fn":"macd"|"macd_signal"|"macd_hist","args":[src, fast, slow, signal]}
 {"type":"bin","op":"+"|"-"|"*"|"/"|">"|"<"|">="|"<="|"=="|"!="|"and"|"or","left":Expr,"right":Expr}
 {"type":"not","arg":Expr} | {"type":"neg","arg":Expr} | {"type":"hist","arg":Expr,"offset":integer}
Lengths must be numbers or refs to inputs. Only use these functions. If the script cannot be
expressed exactly, reply {"error":"<short reason>"}. Never include code to execute.`

export class OpenAiCompatibleConverter implements AiConverter {
  readonly name: string
  constructor(private cfg: AiConverterConfig) {
    this.name = `ai:${cfg.model}`
  }

  async convert(pine: string, parseError: string): Promise<unknown> {
    if (pine.length > LIMITS.maxSourceBytes) throw new Error('source too large')
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs)
    let res: Response
    try {
      res = await (this.cfg.fetch ?? fetch)(`${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({
          model: this.cfg.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Deterministic parser error: ${parseError}\n\nPine source:\n${pine}` },
          ],
        }),
      })
    } catch (e) {
      throw new Error((e as Error).name === 'AbortError' ? 'AI request timed out' : 'AI request failed')
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}`)
    const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null
    const content = body?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.length > 100_000) throw new Error('AI returned no usable content')
    return parseAiJson(content)
  }
}

/** Extracts one JSON object from model output (tolerates code fences). Throws on {"error":...}. */
export function parseAiJson(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error('AI returned invalid JSON')
  }
  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
    throw new Error(`AI declined: ${String((parsed as { error: unknown }).error).slice(0, 200)}`)
  }
  return parsed
}

/** Server flag. Reads env only. Returns the disabled converter unless explicitly turned on. */
export function getAiConverter(env: Record<string, string | undefined> = process.env, f?: typeof fetch): AiConverter {
  if (env.PINE_AI_CONVERTER !== 'on' || !env.PINE_AI_API_KEY) return new DisabledAiConverter()
  return new OpenAiCompatibleConverter({
    apiKey: env.PINE_AI_API_KEY,
    baseUrl: env.PINE_AI_BASE_URL || 'https://api.openai.com/v1',
    model: env.PINE_AI_MODEL || 'gpt-4o-mini',
    timeoutMs: Math.min(Number(env.PINE_AI_TIMEOUT_MS) || 20_000, 60_000),
    fetch: f,
  })
}
