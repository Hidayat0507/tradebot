# Task 990 progress

- Branched `ai/task-tradebot-filler-990` from `origin/main` (`150e0a0`).
- Checked `gh pr list`: only #37 (auth redirect normalization) is open.
- Selected an independent market-cache expiry fix: expire at the TTL boundary and use the default TTL for unknown data types, including Object prototype property names.
- Scope: cache helper, offline fake-clock regression tests, and this note. No deployment or trading operations.
- Reproduced eight failures before the fix; committed and pushed the WIP tests.
- Expiry now starts exactly at the TTL. Only own properties of the TTL configuration override the default; prototype names no longer keep entries cached indefinitely.
- Focused cache suite: 18/18 passed. Full offline suite: 551/551 passed across 44 files with one worker.
- `tsc --noEmit --incremental false` and `git diff --check` passed.
