# Task 980 progress

- Branched `ai/task-tradebot-filler-980` from `origin/main` (`150e0a0`).
- `gh pr list --state open` returned no open PRs.
- Selected a small auth redirect fix: dot segments (including percent-encoded dots) can normalize an allowed destination back into `/auth`, bypassing the auth-loop guard.
- Scope: normalize the pathname for validation and add offline helper/email-confirmation regressions. Preserve accepted destinations and their queries/fragments.
