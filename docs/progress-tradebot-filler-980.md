# Task 980 progress

- Branched `ai/task-tradebot-filler-980` from `origin/main` (`150e0a0`).
- `gh pr list --state open` returned no open PRs.
- Selected a small auth redirect fix: dot segments (including percent-encoded dots) can normalize an allowed destination back into `/auth`, bypassing the auth-loop guard.
- Scope: normalize the pathname for validation and add offline helper/email-confirmation regressions. Preserve accepted destinations and their queries/fragments.
- Reproduced 14 failing regressions before the fix: seven literal/encoded dot-segment destinations through both the helper and mocked email-confirmation route.
- Fixed the guard using URL pathname normalization; allowed destinations retain their original text. Added five preservation cases for normal local paths, queries, fragments, and similarly named routes.
- Validation: focused auth tests 37/37; full offline Vitest suite 562/562 across 44 files with one worker; `tsc --noEmit --incremental false` and `git diff --check` passed.
