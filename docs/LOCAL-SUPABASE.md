# Local Supabase and e2e

This runs Supabase in Docker on your machine, with a real Auth server, PostgREST,
Postgres, Studio, and a local mail inbox. No hosted project, Supabase login, linked
project, exchange credentials, or Stripe keys are needed.

Requirements: Node 20+, npm, Docker Engine/Desktop running, and permission to use
its socket. On Linux, add your user to the Docker group and start a new login
session if `docker info` reports permission denied. Ports 54320–54324 and 3100 must
be available. First startup downloads container images and can take several minutes.
The CLI is pinned in devDependencies; install with `npm ci`. The e2e npm command
enables Node 20’s WebSocket flag for the current Supabase SDK.

```sh
npm run supabase:start
npm run test:e2e:local
```

`test:e2e:local` starts the dedicated `tradebot-codex-local` stack if necessary,
applies pending migrations with `migration up --local`, runs the pgTAP owner/RLS
suite, and launches its own Next.js server at http://127.0.0.1:3100. It refuses an
already running app on that port. It creates synthetic users through Auth, signs
in with password authentication and SSR cookies, then tests the application APIs
and database with real user JWTs. This is an HTTP/API e2e suite; it does not automate
browser clicks or place sandbox exchange orders.

Coverage includes rejected passwords; verified sessions; protected-page redirects;
bot creation, encryption and hashed webhook secrets; owner updates/deletion;
cross-user read/update/delete attempts; Pine sample preview and strategy saving;
column grants; anonymous access; replay claims; paper buy/sell fills and PnL;
owner-only dashboard queries; subscription isolation; cron authentication; cascading
deletion; and sign-out. The pgTAP suite also tests owner/other-user/anonymous/service
roles directly in Postgres. Fixtures are cleaned up even on failure; SQL fixtures
are rolled back. Existing local data is retained.

The wrappers generate per-checkout development keys in the ignored
`supabase/.temp/local-keys.json` with file mode 0600 and supply them only to local
CLI/app processes. Retain that file while the stack is running.
The runner reads only keys returned by **local** `supabase status`, checks the exact
loopback API URL, and never prints keys or sessions. Its app receives `TRADING_MODE=paper`,
a temporary encryption key, and no inherited hosted-service credentials. A preload
guard rejects outbound connections outside loopback. App logs stay in a private
system temporary directory; the runner prints their path for troubleshooting.
It shuts down its app process group on completion and leaves Supabase running.
Do not run `npm run build` concurrently with this suite: both use Next.js’s `.next`
directory.
An existing `.env` file is unnecessary; the local connection and safety settings
are explicitly supplied to the child app.

Useful commands:

```sh
npm test -- --run --maxWorkers=2 --minWorkers=1
npm run test:db -- --maxWorkers=2 --minWorkers=1  # offline PGlite
npm run test:db:local                         # Docker Postgres + pgTAP
npm run supabase:reset                        # deletes ONLY this stack's local DB data
npm run supabase:stop                         # stops this stack, retains local data
```

Studio: http://127.0.0.1:54323. Local mail: http://127.0.0.1:54324.
Email confirmation is disabled for synthetic local accounts. Realtime, Storage,
analytics, and edge functions are disabled because these tests do not use them.
Do not use this development configuration as a production deployment.

## Fresh database migration fixes

The new base-table migration creates the previously implicit `bots` and `trades`
tables before later migrations reference them. `IF NOT EXISTS` preserves existing
tables. The initial signals migration now uses UUID `bot_id`, matching `bots.id`;
the existing repair migration remains for databases with legacy text columns.
PGlite now asserts that **every** migration succeeds in sequence, rather than
accepting the initial signals failure. None of these changes is applied to a
hosted database by the local scripts.

## Troubleshooting

- Docker socket denied: verify `docker info` in the same shell that runs npm.
- Port in use: stop the conflicting local service or app before retrying.
- Container setup fails: check Docker disk/memory and container health. The npm
  wrapper suppresses CLI output because it can contain local keys. Direct CLI
  commands also need the development keys supplied by the wrapper. On Linux hosts
  with both legacy and nftables rules, a legacy FORWARD drop policy can block
  communication inside a new Docker bridge even while Postgres is healthy. Have
  the host administrator reconcile those Docker rules before retrying.
- A test fails: inspect the private app log path printed by the runner. Do not
  paste unredacted logs, JWTs, passwords, or CLI status output into issues.
- `supabase:reset` is optional and destructive to this local database only. The
  e2e runner itself uses pending migrations and never resets your database.

Validated in this run: 55 HTTP/API e2e checks and 49 pgTAP RLS checks passed,
along with the offline unit and database suites.

The wrappers use explicit `--local` for database commands and do not offer hosted
flags. Do not run `supabase link`, `db push`, or `db reset --linked` for this workflow.

See the official [local development guide](https://supabase.com/docs/guides/local-development/cli/getting-started)
and [migration guide](https://supabase.com/docs/guides/local-development/database-migrations).
