export function sma(src: number[], len: number): number[] {
  const out = new Array<number>(src.length).fill(NaN)
  let sum = 0
  let count = 0
  for (let i = 0; i < src.length; i++) {
    const v = src[i]
    if (Number.isNaN(v)) { sum = 0; count = 0; continue }
    sum += v; count++
    if (count > len) { sum -= src[i - len]; count = len }
    if (count === len) out[i] = sum / len
  }
  return out
}

export function ema(src: number[], len: number): number[] {
  return smoothed(src, len, 2 / (len + 1))
}

/** Pine's ta.rma: alpha = 1/len, seeded with SMA. */
export function rma(src: number[], len: number): number[] {
  return smoothed(src, len, 1 / len)
}

function smoothed(src: number[], len: number, alpha: number): number[] {
  const out = new Array<number>(src.length).fill(NaN)
  let prev = NaN
  let seed = 0
  let n = 0
  for (let i = 0; i < src.length; i++) {
    const v = src[i]
    if (Number.isNaN(v)) continue
    if (Number.isNaN(prev)) {
      seed += v; n++
      if (n === len) { prev = seed / len; out[i] = prev }
    } else {
      prev = alpha * v + (1 - alpha) * prev
      out[i] = prev
    }
  }
  return out
}

export function rsi(src: number[], len: number): number[] {
  const up: number[] = [NaN]
  const down: number[] = [NaN]
  for (let i = 1; i < src.length; i++) {
    const d = src[i] - src[i - 1]
    up.push(Number.isNaN(d) ? NaN : Math.max(d, 0))
    down.push(Number.isNaN(d) ? NaN : Math.max(-d, 0))
  }
  const u = rma(up, len)
  const dn = rma(down, len)
  return u.map((uv, i) => {
    const dv = dn[i]
    if (Number.isNaN(uv) || Number.isNaN(dv)) return NaN
    if (dv === 0) return 100
    if (uv === 0) return 0
    return 100 - 100 / (1 + uv / dv)
  })
}

export function atr(high: number[], low: number[], close: number[], len: number): number[] {
  const tr = high.map((h, i) =>
    i === 0 ? h - low[i] : Math.max(h - low[i], Math.abs(h - close[i - 1]), Math.abs(low[i] - close[i - 1])))
  return rma(tr, len)
}

export function macd(src: number[], fast: number, slow: number, signal: number) {
  const f = ema(src, fast), s = ema(src, slow)
  const line = f.map((v, i) => v - s[i])
  const sig = ema(line, signal)
  return { line, signal: sig, hist: line.map((v, i) => v - sig[i]) }
}

export function shift(src: number[], offset: number): number[] {
  return src.map((_, i) => (i - offset >= 0 ? src[i - offset] : NaN))
}

export function crossover(a: number[], b: number[]): number[] {
  return a.map((v, i) =>
    i > 0 && v > b[i] && a[i - 1] <= b[i - 1] ? 1 : 0)
}

export function crossunder(a: number[], b: number[]): number[] {
  return a.map((v, i) =>
    i > 0 && v < b[i] && a[i - 1] >= b[i - 1] ? 1 : 0)
}
