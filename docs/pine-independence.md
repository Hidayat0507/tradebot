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
  `ta.crossover(a, b)`, `ta.crossunder(a, b)`, `ta.atr(len)`,
  `[m, s, h] = ta.macd(src, fast, slow, signal)` (tuple; `_` to skip). Lengths must be constant/input.
- History references `x[n]` with integer literal `n` (phase 2).
- Operators: `+ - * /`, comparisons, `and or not`, parentheses, `true/false`.
- Variable assignment `name = expr` (`var` / `:=` not supported).
- `strategy.exit(id, from_entry, stop=price, limit=price [, when=])` – price levels only
  (`profit=`/`loss=` ticks and trailing not supported). Placed at bar close, active next bar;
  if stop and limit both hit in one bar the stop wins (conservative); gaps fill at open.
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

## Phase 2 (feat/pine-phase2)
- Pine: `ta.atr`, `ta.macd` tuple, `x[n]` history, `strategy.exit` stop/limit (backtest).
- UI: exchange / symbol / timeframe picker for public candles (allowlist: binance, bybit, okx, kraken, bitget).
- DB: `supabase/migrations/20261031000200_bot_strategies.sql` — one definition per bot, owner RLS,
  insert/update require owning the bot, `mode = 'paper'` check, scheduler cursor not user-writable.
  **Written only, not applied.**
- `src/lib/strategy/paper-scheduler.ts` — `runPaperTick(deps)`:
  1. load enabled strategies, 2. fetch public candles, drop the still-open candle,
  3. evaluate, replay signals into buy/sell intents (`signalsToIntents`),
  4. only intents after the stored cursor (first run: latest closed bar only — never replays history),
  5. claim `pine:<bot>:<candle>:<seq>:<side>` in `signals` (idempotent), 6. call the existing
  order path with the bot forced to `mode: 'paper'` (`paperOrderPath` refuses anything else),
  7. advance cursor. Errors are isolated per bot. No cron route / DB loader wired yet.
- Not yet live in scheduler: `strategy.exit` stop/limit (needs intrabar monitoring).

## Phase 3 (feat/pine-phase3)
- Scheduler now monitors `strategy.exit` stop/limit on closed candles (stop first, gaps fill at open);
  a hit on bar *i* is sent as a paper order on the tick after bar *i* closes, priced at the level.
- `GET|POST /api/cron/paper-strategies` — requires `Authorization: Bearer $CRON_SECRET`
  (≥16 chars, constant-time compare). Unset secret → 503, wrong token → 401, before any DB access.
  Example Vercel cron (not added): `{ "crons": [{ "path": "/api/cron/paper-strategies", "schedule": "*/5 * * * *" }] }`
  (Vercel sends the CRON_SECRET bearer automatically).
- `createSupabaseSchedulerDeps(serviceClient)` — loads enabled paper strategies joined to enabled bots,
  never selects credentials, re-validates the stored definition, public-exchange allowlist,
  `signals` claim for idempotency, cursor update.
- `PUT|GET|DELETE /api/bots/[id]/strategy` — owner-checked, user-scoped client (RLS), Pine converted
  server-side (client definitions ignored), `enabled` defaults to false on every save.
- Migration fix: column-level grants (a table-level UPDATE grant would override a column revoke),
  so `mode`, `last_candle_time`, `user_id`, `bot_id` are not user-updatable.
- UI `/strategy`: "Save to bot" panel (bot, timeframe, paper size, enable checkbox unticked by default).

## Phase 4 (feat/pine-phase4)
- Dashboard card "Pine strategies (paper)": per-bot status (enabled / waiting / ok / stale, last candle,
  last signal), recent paper trades (`external_id like 'paper-%'`), FIFO paper realized PnL + win rate.
  API: `GET /api/strategy/dashboard` (user-scoped, RLS).
- Migration `20261031000300_bot_strategies_last_signal.sql` (server-owned `last_signal_at`, `last_signal`).
- **Real local Postgres without Docker:** `npm run test:db` runs PGlite (Postgres 17 in WASM, in-process).
  `supabase/tests/local/bootstrap.sql` emulates Supabase roles (`anon`, `authenticated`, `service_role`),
  `auth.uid()`, default grants, and the assumed base `bots`/`trades` tables; then every migration is applied
  and RLS/grants are checked as real roles. Caveat: the bootstrap is an approximation of hosted Supabase
  (base tables are not in this repo's migrations).
- Known issue found: `20261031000000_webhook_signals.sql` declares `signals.bot_id text` referencing
  `bots.id` — if `bots.id` is `uuid` (as in the RLS PR #8) the FK fails. Needs a follow-up migration.

## Phase 5 (feat/pine-phase5)
### AI converter (server flag, off by default)
| env | meaning |
|---|---|
| `PINE_AI_CONVERTER=on` | enable (any other value = off) |
| `PINE_AI_API_KEY` | provider key — env only, never logged or returned |
| `PINE_AI_BASE_URL` | OpenAI-compatible base URL (default `https://api.openai.com/v1`) |
| `PINE_AI_MODEL` | default `gpt-4o-mini` |
| `PINE_AI_TIMEOUT_MS` | default 20000, max 60000 |

Only called when the deterministic parser fails. Output → `parseAiJson` → `validateDefinition`
(same closed AST as the parser); preview/save show a "Review carefully" warning and store `converter='ai'`.
Eval set: `src/lib/strategy/ai-eval/cases.ts` (5 convertible + 3 must-reject cases; pass = identical
signals to a hand-written reference on 3 candle sets). Run against a real provider manually with
`npx tsx scripts/pine-ai-eval.ts` (exit 1 below 80%). CI uses mocked models only.

### CI
`.github/workflows/ci.yml`: lint, tsc, unit tests, `npm run test:db` (PGlite), build with dummy public env.

### signals.bot_id fix
`20261031000400_signals_bot_id_uuid.sql` — **confirm hosted `bots.id` type before applying.**
