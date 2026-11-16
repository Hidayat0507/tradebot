# Task 996 progress

- Branched `ai/task-tradebot-filler-996` from `origin/main`.
- Checked open PRs: #37 (auth redirects), #38 (market cache TTL), #39 (logging redaction).
- Selected separate bug: bot POST/PUT accept invalid default order-size percentages despite the UI contract of 0.01–100%.
- Added mocked route regressions for invalid types, out-of-range percentages, JSON numeric overflow, valid boundaries, and omitted values. No external service or exchange calls.
- Reproduced 24 rejected-input regressions: both routes returned success before the fix.
