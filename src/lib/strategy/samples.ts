export const SAMPLE_PINE = {
  emaCross: `//@version=5
strategy("EMA Cross", overlay=true)
fastLen = input.int(9, "Fast")
slowLen = input.int(21, "Slow")
fast = ta.ema(close, fastLen)
slow = ta.ema(close, slowLen)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long)
if ta.crossunder(fast, slow)
    strategy.close("Long")
`,
  rsi: `//@version=5
strategy("RSI Reversion")
len = input(14)
r = ta.rsi(close, len)
strategy.entry("L", strategy.long, when = ta.crossover(r, 30))
strategy.close("L", when = r > 70)
`,
  smaLongShort: `//@version=5
strategy("SMA trend long/short")
basis = ta.sma(close, 50)
trendUp = close > basis and ta.ema(close, 10) > basis
if trendUp and not (close < open)
    strategy.entry("Long", strategy.long)
if close < basis
    strategy.entry("Short", strategy.short)
`,
  macdAtrStops: `//@version=5
strategy("MACD + ATR stops")
[m, sig, hist] = ta.macd(close, 12, 26, 9)
a = ta.atr(14)
if ta.crossover(m, sig) and hist[1] < 0
    strategy.entry("Long", strategy.long)
strategy.exit("XL", "Long", stop = close - 2 * a, limit = close + 3 * a)
if ta.crossunder(m, sig)
    strategy.close("Long")
`,
} as const
