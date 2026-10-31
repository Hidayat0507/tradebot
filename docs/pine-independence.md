# TradingView independence: Pine → in-app strategy evaluation

Status: draft / phase 1. **Paper mode only.**

## Goal
Today TradingView evaluates the strategy and POSTs a webhook signal. We want the
user to paste a Pine Script strategy, convert it to a Tradebot strategy
definition, and let the app compute the signals itself from exchange OHLCV
(ccxt *public* market data — no API keys).

## Architecture
```
Pine source ──▶ converter ──▶ StrategyDefinition (JSON, versioned)
                 │  1. deterministic parser (supported subset)
                 │  2. AiConverter interface (fallback, disabled by default)
                 ▼
candles (sample | cache | ccxt public fetchOHLCV)
                 ▼
runtime.evaluate(def, candles) → Signal[]     (pure function)
                 ▼
backtest(def, candles) → trades, PnL           (paper, pure)
                 ▼
(future) scheduler → paper executor → same order path as webhook (paper)
```
Modules live in `src/lib/strategy/`:
- `types.ts` – `StrategyDefinition`, `Expr` AST, `Candle`, `Signal`.
- `indicators.ts` – sma, ema, rsi (Wilder/RMA, matches Pine), crossover/crossunder.
- `runtime.ts` – interpreter over the AST, returns per-bar signals.
- `backtest.ts` – simulated fills at next bar open, single position, reversals.
- `pine/parser.ts` – tokenizer + recursive-descent parser for the subset.
- `converter.ts` – parser first; on `PineParseError` delegates to an `AiConverter`.
  Default is `DisabledAiConverter` (no network, no keys). Any AI output must
  pass the same `validateDefinition` as parser output.
- `sample-candles.ts` – deterministic synthetic candles for preview/tests.
- `market-data.ts` – ccxt public `fetchOHLCV` wrapper (no credentials ever passed).

API: `POST /api/strategy/preview` `{ pine, candles? }` → definition, signals,
backtest. UI: `/strategy` (paste → preview → backtest).

## Supported Pine subset (v5)
- `//@version=5`, `strategy(...)`, `indicator` rejected.
- Inputs: `x = input(10)`, `input.int(10, ...)`, `input.float(...)`.
- Sources: `open high low close volume`, `hl2`, `hlc3`.
- `ta.sma(src, len)`, `ta.ema(src, len)`, `ta.rsi(src, len)`,
  `ta.crossover(a, b)`, `ta.crossunder(a, b)`. Lengths must be constant/input.
- Operators: `+ - * /`, comparisons, `and or not`, parentheses, `true/false`.
- Variable assignment `name = expr` (`var` / `:=` / history `[]` not supported).
- `strategy.entry(id, strategy.long|strategy.short [, when=cond])`,
  `strategy.close(id [, when=cond])`, `strategy.close_all()`.
- `if cond` followed by indented entry/close lines (one level).
Anything else raises `PineParseError` with the line number.

## Safety model
- **No code execution.** The definition is pure data (an AST). The runtime is an
  interpreter with a closed set of node types and functions — no `eval`,
  `Function`, `vm`, imports or I/O. Unknown nodes are rejected by `validateDefinition`.
- Resource limits: max source size (20 KB), max nodes (500), max indicator
  length (1000), max candles (5000).
- Runtime and backtest are pure: no network, DB, exchange or clock access.
- Market data uses ccxt public endpoints only; never constructed with keys.
- AI fallback is behind an interface; output is untrusted and must validate.
  No provider wired, no keys read.
- Preview endpoint never places orders and never writes to the DB.

## Paper mode by default
Signals produced here are for preview/backtest. When wired into bots later,
the evaluator will emit into the existing order path which honours
`TRADING_MODE=paper` (default). Live trading from in-app strategies will need an
explicit per-bot opt-in plus the existing order caps — out of scope for this PR.

## Next steps
1. Persist definitions per bot (Supabase migration, RLS).
2. Scheduler (cron) fetching closed candles and running paper executor.
3. AI converter implementation behind a server-side flag, with eval set.
4. More Pine: `ta.atr`, `ta.macd`, stop/limit, `strategy.exit`, history refs.
