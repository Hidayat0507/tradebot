# Task 930 progress

- Branch: `ai/task-tradebot-filler-930`, created from `origin/main`.
- Checked open PRs first: #31 (auth redirects), #32 (cache invalidation), #33 (webhook numbers). This task does not overlap those fixes.
- Selected fix: exclude future-dated trades from dashboard 24-hour PnL totals. Preserve all-time totals, trade lists, and live/paper separation.
- Validation planned: deterministic, offline regression tests with an injected clock; run one worker and no builds.
- Safety: no deployment, production access, credentials, or exchange calls required.
- Regression confirmed before the fix: 4 of 9 new tests failed because future rows contributed to 24h PnL.
- Implemented the upper bound `timestamp <= now`, preserving the existing exclusive lower bound.
- Validation passed: `npx --no-install vitest run src/test/pnl-split.test.ts src/test/ux-p0.test.ts --maxWorkers=1 --minWorkers=1` (19 tests); `git diff --check` passed.
- Implementation committed and pushed as `f4e55ea`. Opened the single draft PR #34 into `main`: https://github.com/Hidayat0507/tradebot/pull/34.
- Live `gh pr view` at 2026-11-15T20:10:42Z: `MERGEABLE`, merge state `UNSTABLE`, still draft. Recorded details and appended self-review in `docs/REVIEW-tradebot-filler-930.md`.

## Task 940 follow-up

- Checked open PRs first: #31 (auth), #32 (cache), #33 (webhook), #34 (PnL on this branch). Reusing draft #34 to keep one PR on the required branch; `origin/main` remains an ancestor.
- Selected a distinct small fix: reject non-finite public OHLCV values. The existing numeric type check admits NaN and infinities into preview/backtest candles.
- Plan: reproduce with a mocked public source, filter malformed rows, run focused offline tests with one worker. No builds, credentials, exchange requests, or deployment commands.
