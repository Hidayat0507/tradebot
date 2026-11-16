Provided preview candles accepted infinite numbers, including valid JSON numbers such as `1e400` that overflow JavaScript's numeric range. These values could reach conversion and backtesting instead of producing a validation error.

Require finite values for all six candle fields. Invalid input now uses the preview route's existing HTTP 400 validation response. Finite input remains accepted, including zero volume.

Validation:
- Regression tests failed before the fix in seven cases.
- Focused preview tests: 13 passed.
- Full offline Vitest suite: 522 passed across 41 files, using one worker.
- TypeScript check and `git diff --check` passed.

Scope: provided-candle request validation only. Separate from open PRs #34 and #35. No deployment, real trading, infrastructure changes, or strategy changes.
