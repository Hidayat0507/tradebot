# Task 930 progress

- Branch: `ai/task-tradebot-filler-930`, created from `origin/main`.
- Checked open PRs first: #31 (auth redirects), #32 (cache invalidation), #33 (webhook numbers). This task does not overlap those fixes.
- Selected fix: exclude future-dated trades from dashboard 24-hour PnL totals. Preserve all-time totals, trade lists, and live/paper separation.
- Validation planned: deterministic, offline regression tests with an injected clock; run one worker and no builds.
- Safety: no deployment, production access, credentials, or exchange calls required.
- Regression confirmed before the fix: 4 of 9 new tests failed because future rows contributed to 24h PnL.
- Implemented the upper bound `timestamp <= now`, preserving the existing exclusive lower bound.
- Validation passed: `npx --no-install vitest run src/test/pnl-split.test.ts src/test/ux-p0.test.ts --maxWorkers=1 --minWorkers=1` (19 tests); `git diff --check` passed.
