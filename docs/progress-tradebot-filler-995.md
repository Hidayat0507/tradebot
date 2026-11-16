# Task 995 progress

- Branched `ai/task-tradebot-filler-995` from `origin/main`.
- Checked open PRs: #37 covers auth redirects; #38 covers market-cache TTL. This fix touches neither area.
- Selected a logging bug: notification failures attach a credential-bearing webhook URL under `webhookUrl`, which the shared logger currently leaves unredacted.
- Plan: redact webhook URL context keys centrally and add offline regression tests with fake values. No network calls, credentials, deployment, or trading required.
- Implemented case-insensitive redaction for `webhookUrl` and `webhook_url` in the shared context sanitizer.
- Added four regression cases covering top-level and nested array fields, preserving ordinary context and leaving caller input unchanged.
- Validation: new cases reproduced the bug (4 failed / 5 existing passed); after the fix, all 9 logging tests passed with one Vitest worker. `git diff --check` passed. Tests use only a fake example.invalid URL and captured console output.
