# Tradebot Task 900 self-review

## Change and rationale

Email confirmation redirected directly to the untrusted `next` query parameter after OTP verification. It now applies the existing `authDestination` helper, matching password sign-in. External URLs, protocol-relative URLs, backslashes, and direct auth destinations fall back to `/dashboard`; valid local destinations retain their query strings.

This was the highest-value small fix found during this pass: it closes a concrete open redirect in an authentication flow with a two-line behavior change and reuses an established guard. It requires no trading, strategy, database, or deployment changes.

## Evidence

- Before the fix, six new regression cases failed by following unsafe or looping destinations.
- After the fix, `npm test -- --run src/test/auth-redirect.test.ts`: 18 tests passed. Cases cover local/default destinations, hostile destinations, failed OTP verification, and missing confirmation parameters.
- Tests mock Supabase and Next's throwing redirect behavior; no hosted service or exchange is called.
- `npx tsc --noEmit --incremental false`: passed.
- `git diff --check origin/main...HEAD`: passed.
- `env -i PATH="$PATH" NEXT_TELEMETRY_DISABLED=1 npm run build`: passed. Existing warnings remain for Supabase Edge Runtime compatibility and unused imports/variables in assets and bot creation. No warnings point to this patch.

## Review and residual risk

Reviewed the route and tests against `origin/main`. OTP verification still gates every successful redirect, and verification failures still return to the existing auth error page. No additional issue found in the patch. Any previously intended off-site confirmation destination will now fall back to the dashboard, as intended by the app's existing destination policy. Validation is local and mocked; an actual email-confirmation/browser flow was not exercised.

## Draft PR

- https://github.com/Hidayat0507/tradebot/pull/31
- Base: `main`; head: `ai/task-tradebot-filler`; draft only.
- Live command: `gh pr view 31 --repo Hidayat0507/tradebot --json mergeable,mergeStateStatus`
- Observed 2026-11-15T17:25:03Z: `{"mergeStateStatus":"UNSTABLE","mergeable":"MERGEABLE"}`. This is a GitHub merge-state observation, not a claim that remote checks passed.
