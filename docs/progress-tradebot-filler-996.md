# Task 996 progress

- Branched `ai/task-tradebot-filler-996` from `origin/main`.
- Checked open PRs: #37 (auth redirects), #38 (market cache TTL), #39 (logging redaction).
- Selected separate bug: bot POST/PUT accept invalid default order-size percentages despite the UI contract of 0.01–100%.
- Added mocked route regressions for invalid types, out-of-range percentages, JSON numeric overflow, valid boundaries, and omitted values. No external service or exchange calls.
- Reproduced 24 rejected-input regressions: both routes returned success before the fix.
- Added a shared finite-number/range guard using `ORDER_SIZE` limits to creation and partial-update validation; supplied invalid values return HTTP 400 before service writes. Omitted values keep existing behavior.
- Validation: focused route tests 40/40; full offline Vitest suite 575/575 across 44 files with one worker; `tsc --noEmit --incremental false` and `git diff --check` passed.
- WIP tests committed and pushed at `739ae03`; implementation milestone committed and pushed separately.
