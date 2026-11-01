/**
 * Eval set for the AI converter. Each case is Pine the deterministic parser cannot handle,
 * plus a `reference` in the supported subset with identical semantics (or `reject: true`).
 * Pass = converted definition yields exactly the same signals as the reference on several
 * candle sets; for reject cases, pass = conversion fails or yields no definition.
 */
export interface EvalCase {
  id: string
  pine: string
  reference?: string
  reject?: true
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'v4-no-namespace',
    pine: `//@version=4
strategy("v4 SMA")
fast = sma(close, 10)
slow = sma(close, 30)
strategy.entry("L", strategy.long, when = crossover(fast, slow))
strategy.close("L", when = crossunder(fast, slow))`,
    reference: `strategy("v4 SMA")
fast = ta.sma(close, 10)
slow = ta.sma(close, 30)
strategy.entry("L", strategy.long, when = ta.crossover(fast, slow))
strategy.close("L", when = ta.crossunder(fast, slow))`,
  },
  {
    id: 'if-else',
    pine: `//@version=5
strategy("If/else")
e = ta.ema(close, 20)
if close > e
    strategy.entry("L", strategy.long)
else
    strategy.close("L")`,
    reference: `strategy("If/else")
e = ta.ema(close, 20)
if close > e
    strategy.entry("L", strategy.long)
if not (close > e)
    strategy.close("L")`,
  },
  {
    id: 'ta-change',
    pine: `//@version=5
strategy("Momentum")
mom = ta.change(close, 3)
if mom > 0 and ta.rsi(close, 14) < 70
    strategy.entry("L", strategy.long)
if mom < 0
    strategy.close("L")`,
    reference: `strategy("Momentum")
mom = close - close[3]
if mom > 0 and ta.rsi(close, 14) < 70
    strategy.entry("L", strategy.long)
if mom < 0
    strategy.close("L")`,
  },
  {
    id: 'ternary-bool',
    pine: `//@version=5
strategy("Ternary")
r = ta.rsi(close, 14)
sig = r < 35 ? true : false
if sig
    strategy.entry("L", strategy.long)
if r > 65
    strategy.close("L")`,
    reference: `strategy("Ternary")
r = ta.rsi(close, 14)
sig = r < 35
if sig
    strategy.entry("L", strategy.long)
if r > 65
    strategy.close("L")`,
  },
  {
    id: 'percent-stop',
    pine: `//@version=5
strategy("Pct stop")
if ta.crossover(ta.ema(close, 9), ta.ema(close, 21))
    strategy.entry("L", strategy.long)
strategy.exit("XL", from_entry = "L", stop = close * (1 - 0.02), limit = close * 1.04)`,
    reference: `strategy("Pct stop")
if ta.crossover(ta.ema(close, 9), ta.ema(close, 21))
    strategy.entry("L", strategy.long)
strategy.exit("XL", "L", stop = close * (1 - 0.02), limit = close * 1.04)`,
  },
  { id: 'reject-security', reject: true, pine: `//@version=5
strategy("MTF")
d = request.security(syminfo.tickerid, "D", close)
if close > d
    strategy.entry("L", strategy.long)` },
  { id: 'reject-vwap', reject: true, pine: `//@version=5
strategy("VWAP")
if ta.crossover(close, ta.vwap)
    strategy.entry("L", strategy.long)` },
  { id: 'reject-var-state', reject: true, pine: `//@version=5
strategy("State")
var int n = 0
n := n + 1
if n % 10 == 0
    strategy.entry("L", strategy.long)` },
  // Adversarial: "almost valid" scripts designed to tempt a sloppy AI into hallucinating a
  // conversion that happens to pass validateDefinition(), instead of declining. See
  // docs/pine-independence.md Phase 6b / design doc Section 4.
  { id: 'reject-function-def', reject: true, pine: `//@version=5
strategy("Custom fn")
f(x) => x * 2
val = f(close)
if val > 100
    strategy.entry("L", strategy.long)` },
  { id: 'reject-library-import', reject: true, pine: `//@version=5
strategy("Lib import")
import TradingView/ta/7 as talib
r = talib.rsi(close, 14)
if r < 30
    strategy.entry("L", strategy.long)` },
  { id: 'reject-unsupported-indicator', reject: true, pine: `//@version=5
strategy("PSAR")
p = ta.sar(0.02, 0.02, 0.2)
if close > p
    strategy.entry("L", strategy.long)` },
]
