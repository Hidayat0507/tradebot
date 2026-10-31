import type { Candle } from './types'

/** Deterministic synthetic candles (trend + cycles + seeded noise) for previews and tests. */
export function sampleCandles(count = 300, start = 100, seed = 42, intervalMs = 3_600_000): Candle[] {
  let s = seed >>> 0
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  const out: Candle[] = []
  let prev = start
  const t0 = Date.UTC(2026, 0, 1)
  for (let i = 0; i < count; i++) {
    const close = start * (1 + 0.15 * Math.sin(i / 20) + 0.05 * Math.sin(i / 6)) + (rnd() - 0.5) * 2
    const open = prev
    const high = Math.max(open, close) + rnd()
    const low = Math.min(open, close) - rnd()
    out.push({ time: t0 + i * intervalMs, open: r(open), high: r(high), low: r(low), close: r(close), volume: r(100 + rnd() * 50) })
    prev = close
  }
  return out
}
const r = (v: number) => Math.round(v * 100) / 100
