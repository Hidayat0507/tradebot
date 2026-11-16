import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/lib/logging'

afterEach(() => vi.restoreAllMocks())

describe('log context serialization', () => {
  it.each(['webhookUrl', 'webhook_url', 'WEBHOOK_URL', 'WebhookURL'])('redacts credential-bearing %s fields at every depth', key => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fakeUrl = 'https://example.invalid/api/webhooks/test-id/dummy-test-value'
    const context = { [key]: fakeUrl, deliveries: [{ [key]: fakeUrl, status: 503 }], symbol: 'BTC/USDT' }

    logger.error('Notification failed', new Error('offline'), context)

    expect(JSON.parse(output.mock.calls[0][0]).context).toEqual({
      [key]: '[REDACTED]', deliveries: [{ [key]: '[REDACTED]', status: 503 }], symbol: 'BTC/USDT',
    })
    expect(output.mock.calls[0][0]).not.toContain(fakeUrl)
    expect(context[key]).toBe(fakeUrl)
  })

  it('handles circular objects without interrupting error reporting', () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => {})
    const context: Record<string, unknown> = { operation: 'balance' }
    context.self = context

    expect(() => logger.error('Request failed', new Error('offline'), context)).not.toThrow()
    expect(JSON.parse(output.mock.calls[0][0]).context).toEqual({
      operation: 'balance', self: '[Circular]',
    })
  })

  it('handles cycles through arrays', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => {})
    const items: unknown[] = []
    items.push(items)

    expect(() => logger.info('Items', { items })).not.toThrow()
    expect(JSON.parse(output.mock.calls[0][0]).context).toEqual({ items: ['[Circular]'] })
  })

  it('serializes bigint values as decimal strings without losing precision', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => {})

    expect(() => logger.info('IDs', { ids: [BigInt('9007199254740993'), BigInt(-2), BigInt(0)] })).not.toThrow()
    expect(JSON.parse(output.mock.calls[0][0]).context).toEqual({ ids: ['9007199254740993', '-2', '0'] })
  })

  it('preserves repeated non-circular objects and does not mutate input', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => {})
    const shared = Object.freeze({ symbol: 'BTC/USDT' })
    const context = Object.freeze({ first: shared, second: shared })

    logger.info('Symbols', context)

    expect(JSON.parse(output.mock.calls[0][0]).context).toEqual(context)
    expect(context.first).toBe(context.second)
  })

  it('redacts sensitive fields before traversing circular values', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => {})
    const context: Record<string, unknown> = { nested: { api_key: 'dummy-test-value' } }
    context.token = context

    logger.info('Redaction', context)

    expect(JSON.parse(output.mock.calls[0][0]).context).toEqual({
      nested: { api_key: '[REDACTED]' }, token: '[REDACTED]',
    })
  })
})
