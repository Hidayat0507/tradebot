import { describe, expect, it } from 'vitest'
import {
  getExchangePlugin,
  listEnabledExchanges,
  normalizeExchangeId,
  ExchangeNotFoundError,
} from '@/lib/exchanges/registry'

describe('Exchange workflow helpers', () => {
  it('normalizes exchange identifiers regardless of casing', () => {
    expect(normalizeExchangeId('Bitget')).toBe('bitget')
    expect(normalizeExchangeId('HYPERLIQUID')).toBe('hyperliquid')
  })

  it('exposes registered exchange plugins', () => {
    const plugins = listEnabledExchanges().map((plugin) => plugin.id)
    expect(plugins).toContain('bitget')
    expect(plugins).toContain('hyperliquid')
  })

  it('throws on unsupported exchanges', () => {
    expect(() => getExchangePlugin('unknown')).toThrow(ExchangeNotFoundError)
  })
})
