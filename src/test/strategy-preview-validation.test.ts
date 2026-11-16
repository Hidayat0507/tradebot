import { describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { previewSchema, runPreview } from '@/lib/strategy/preview'

const candle = { time: 1_700_000_000_000, open: 100, high: 110, low: 90, close: 105, volume: 0 }
const request = (first = candle) => ({
  pine: 'strategy("Validation")',
  candles: [first, { ...candle, time: candle.time + 60_000 }],
})

describe('provided preview candle validation', () => {
  it.each(['time', 'open', 'high', 'low', 'close', 'volume'] as const)(
    'rejects non-finite %s values', field => {
      for (const value of [Infinity, -Infinity, NaN]) {
        expect(() => previewSchema.parse(request({ ...candle, [field]: value }))).toThrow(ZodError)
      }
    },
  )

  it('rejects JSON numeric overflow before conversion or exchange access', async () => {
    // A valid JSON number can overflow JavaScript's finite numeric range.
    const body = JSON.parse(JSON.stringify(request()).replace('"close":105', '"close":1e400'))
    expect(body.candles[0].close).toBe(Infinity)
    const ai = { name: 'test', convert: vi.fn() }
    const publicExchange = vi.fn()
    await expect(runPreview(body, { ai, publicExchange })).rejects.toBeInstanceOf(ZodError)
    expect(ai.convert).not.toHaveBeenCalled()
    expect(publicExchange).not.toHaveBeenCalled()
  })

  it('accepts finite candle data including zero volume', () => {
    expect(previewSchema.parse(request()).candles).toEqual(request().candles)
  })
})
