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
} as const
