import { describe, expect, it } from 'vitest'
import { validateBotData } from '@/app/api/_middleware/api-handler'
import { ApiError } from '@/app/api/_middleware/api-handler'

describe('Bot configuration workflow', () => {
  it('accepts a payload with enabled exchange and required fields', () => {
    expect(() =>
      validateBotData({
        name: 'Test Bot',
        exchange: 'bitget',
        pair: 'BTC/USDT',
      })
    ).not.toThrow()
  })

  it('rejects unsupported exchanges', () => {
    expect(() =>
      validateBotData({
        name: 'Invalid Bot',
        exchange: 'kraken',
        pair: 'BTC/USDT',
      })
    ).toThrow(ApiError)
  })
})
