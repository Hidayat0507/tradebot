Dependency upgrade verification (2026-10-31)
==========================================

Next.js, eslint-config-next, and @next/swc-wasm-nodejs are pinned to
15.5.28, the latest published Next.js 15 release checked with npm.
Unused direct dependencies were removed. @supabase/auth-helpers-nextjs
remains because the bot toggle route still imports it.

`npm audit --omit=dev` against the original HEAD package.json and
package-lock.json, copied to a temporary directory without installing:

| Severity | Before | After |
| --- | ---: | ---: |
| Low | 6 | 0 |
| Moderate | 21 | 0 |
| High | 13 | 1 |
| Critical | 2 | 0 |
| Total | 42 | 1 |

`npm audit fix` was run without --force, using a writable temporary npm
cache. The remaining production advisory is Zod
GHSA-mrhx-c7xc-m3w5. npm proposes Zod 4.6.7, a breaking major upgrade;
that migration was not forced into this dependency patch. The full audit
also reports development dependency advisories (21 findings total,
including the production finding).

Review scope: the minimal paper fill branch in execute-trade.ts is retained
because this task explicitly requires paper mode. It returns before exchange
access, using only the supplied amount and price. It does not alter the live
execution branch. Tests mock ccxt and Supabase and default to paper mode.

Validation: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`, and
`npx next build` all passed. Vitest: 6 files, 28 passed, 5 skipped
(credential-gated tests). Build warns about Supabase's process.version use
in the Edge Runtime. Checks used a temporary NODE_OPTIONS preload that
disables Next.js .env loading and blocks fetch/http/https requests, so no
secrets or hosted services were needed. No orders were submitted.
