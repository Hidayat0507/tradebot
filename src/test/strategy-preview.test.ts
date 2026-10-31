import { describe, expect, it, vi } from 'vitest'
import { runPreview } from '@/lib/strategy/preview'
import { SAMPLE_PINE } from '@/lib/strategy/samples'
import { sampleCandles } from '@/lib/strategy/sample-candles'

describe('runPreview', () => {
  it('sample candles by default, paper mode', async () => {
    const r = await runPreview({ pine: SAMPLE_PINE.emaCross })
    expect(r.ok && r.mode).toBe('paper')
    expect(r.ok && r.candleSource).toBe('sample')
  })
  it('uses provided cached candles', async () => {
    const r = await runPreview({ pine: SAMPLE_PINE.rsi, candles: sampleCandles(120, 50, 7) })
    expect(r.ok && r.candleCount).toBe(120)
  })
  it('public exchange data via injected ccxt (no keys)', async () => {
    const rows = sampleCandles(100).map((c) => [c.time, c.open, c.high, c.low, c.close, c.volume])
    const fetchOHLCV = vi.fn().mockResolvedValue(rows)
    const publicExchange = vi.fn().mockResolvedValue({ fetchOHLCV })
    const r = await runPreview({ pine: SAMPLE_PINE.emaCross, candles: { exchange: 'binance', symbol: 'BTC/USDT', limit: 100 } }, { publicExchange })
    expect(publicExchange).toHaveBeenCalledWith('binance')
    expect(fetchOHLCV).toHaveBeenCalledWith('BTC/USDT', '1h', undefined, 100)
    expect(r.ok && r.candleCount).toBe(100)
  })
  it('returns parse error for unsupported pine; rejects bad input', async () => {
    const r = await runPreview({ pine: 'strategy("x")\nx = ta.atr(14)' })
    expect(r.ok).toBe(false)
    await expect(runPreview({ pine: '' })).rejects.toThrow()
    await expect(runPreview({ pine: 'x', candles: { exchange: '../x', symbol: 'BTC/USDT' } })).rejects.toThrow()
  })
})
