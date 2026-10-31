import { parsePine, PineParseError } from './pine/parser'
import type { StrategyDefinition } from './types'
import { validateDefinition } from './validate'

/** Pluggable AI fallback. Implementations must return untrusted JSON; it is always re-validated. */
export interface AiConverter {
  readonly name: string
  convert(pine: string, parseError: string): Promise<unknown>
}

/** Default: no provider, no network, no keys. */
export class DisabledAiConverter implements AiConverter {
  readonly name = 'disabled'
  async convert(): Promise<unknown> {
    throw new Error('AI conversion is not enabled')
  }
}

export type ConvertResult =
  | { ok: true; definition: StrategyDefinition; via: 'parser' | 'ai'; warnings: string[] }
  | { ok: false; error: string; via: 'parser' | 'ai' }

export async function convertPine(pine: string, ai: AiConverter = new DisabledAiConverter()): Promise<ConvertResult> {
  try {
    return { ok: true, definition: parsePine(pine), via: 'parser', warnings: [] }
  } catch (e) {
    if (!(e instanceof PineParseError)) throw e
    if (ai instanceof DisabledAiConverter) return { ok: false, error: e.message, via: 'parser' }
    try {
      const definition = validateDefinition(await ai.convert(pine, e.message))
      return { ok: true, definition, via: 'ai', warnings: [`Parser failed (${e.message}); converted by ${ai.name}. Review carefully.`] }
    } catch (err) {
      return { ok: false, error: `parser: ${e.message}; ai: ${(err as Error).message}`, via: 'ai' }
    }
  }
}
