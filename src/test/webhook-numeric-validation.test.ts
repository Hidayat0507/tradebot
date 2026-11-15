import { describe, expect, it, vi } from 'vitest'
import { validateWebhookAlert } from '@/app/api/_middleware/webhook/validate-webhook'
import { ApiError } from '@/app/api/_middleware/api-handler'

vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn() } }))
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))

const payload = () => ({
  ts: new Date().toISOString(), alert_id: 'numeric-validation',
  bot_id: 'test-bot', symbol: 'BTC/USDT', action: 'buy', secret: 'test-only',
})
const fields = ['price', 'amount', 'stoplossPercent', 'order_size'] as const

describe('webhook numeric validation', () => {
  describe.each(fields)('%s', field => {
    it.each(['12oops', '12%', '12.3.4', '1e', '1,000', '0x10', '', '   ', 'Infinity', 'NaN', null, true, [], {}, NaN, Infinity, -Infinity, 0, -1])(
      'rejects malformed or nonpositive value %j with HTTP 400', value => {
        expect(() => validateWebhookAlert({ ...payload(), [field]: value })).toThrowError(
          expect.objectContaining({ name: 'ApiError', statusCode: 400 }),
        )
      },
    )

    it.each(['12.5', ' 12.5 ', '+12.5', '.5', '1e1', '1.25e-2', 12.5])(
      'normalizes valid decimal value %j without changing the input', value => {
        const input = { ...payload(), [field]: value }
        expect(validateWebhookAlert(input)[field]).toBe(Number(value))
        expect(input[field]).toBe(value)
      },
    )
  })

  it('keeps numeric fields optional', () => {
    const result = validateWebhookAlert(payload())
    for (const field of fields) expect(result[field]).toBeUndefined()
  })

  it('preserves percentage bounds and accepts order size of 100', () => {
    expect(validateWebhookAlert({ ...payload(), order_size: '100' }).order_size).toBe(100)
    expect(() => validateWebhookAlert({ ...payload(), stoplossPercent: '100' })).toThrow(ApiError)
    expect(() => validateWebhookAlert({ ...payload(), order_size: '100.1' })).toThrow(ApiError)
  })
})
