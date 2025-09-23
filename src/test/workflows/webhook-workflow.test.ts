import { describe, expect, it } from 'vitest'
import { validateWebhookAlert } from '@/app/api/_middleware/webhook/validate-webhook'
import { ApiError } from '@/app/api/_middleware/api-handler'

describe('Webhook workflow', () => {
  it('strips secret and normalizes action for valid alerts', () => {
    const payload = {
      bot_id: 'ABC123',
      symbol: 'BTC/USDT',
      action: 'BUY',
      secret: 'top-secret',
      price: '42000.5',
      stoplossPercent: '3',
      order_size: '50',
    }

    const result = validateWebhookAlert(payload)

    expect(result).toEqual({
      bot_id: 'ABC123',
      symbol: 'BTC/USDT',
      action: 'buy',
      price: 42000.5,
      stoplossPercent: 3,
      order_size: 50,
    })
  })

  it('throws an ApiError when required fields are missing', () => {
    expect(() =>
      validateWebhookAlert({
        symbol: 'BTC/USDT',
        action: 'BUY',
        secret: 'something',
      })
    ).toThrow(ApiError)
  })
})
