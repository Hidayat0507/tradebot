# Tradebot UX Audit — for a non-technical trader

**Method:** static read-through of the Next.js app (`src/app`, `src/components`, `src/lib`) on branch `ai/claude-ux-audit`. No dev server or tests were run; every claim below is traceable to a file/line. "Non-technical trader" is the yardstick throughout — someone who understands candles, stop-losses and TradingView alerts, but not JSON, API secrets, or raw backend errors.

Priority key: **P0** — blocks or actively misleads/harms the user · **P1** — major friction or trust damage · **P2** — polish.

---

## Top 10

| # | Pri | Finding | File(s) |
|---|-----|---------|---------|
| 1 | P0 | Hyperliquid credential fields are mislabeled: the form always says "API Key"/"API Secret", but for Hyperliquid these are actually the **wallet address** and **private key** — no relabeling, no warning. | `src/app/bots/create/components/create-bot-form.tsx:420-469`, `src/lib/exchanges/hyperliquid.ts:7-23` |
| 2 | P0 | "Total Portfolio Value" on the Assets page is computed from a **hardcoded, fake price table** (BTC pinned at $50,000), not live prices. The dollar figure shown to traders is fabricated. | `src/app/assets/page.tsx:57-78` |
| 3 | P0 | `router.push('/auth/login')` points at a route that doesn't exist (real route is `/auth`); hitting it drops the user into Next's unstyled default error page because the app has **no custom `not-found.tsx`/`error.tsx` anywhere**. | `src/app/bots/create/components/create-bot-form.tsx:141,149` |
| 4 | P0 | The Bots list table wraps in `overflow-hidden` instead of `overflow-x-auto` — on a phone, the Status/Actions columns (Pause/Delete/View) are **clipped off-screen with no way to scroll to them**. | `src/app/bots/page.tsx:105-162` |
| 5 | P0 | The Pine Script tool is linked in primary nav as "Strategies" for every user, but it's a raw developer console (code textarea, JSON strategy-definition dump, "via engine" internals) with zero onboarding for someone who doesn't code. | `src/components/Navigation.tsx:85`, `src/app/strategy/page.tsx` |
| 6 | P1 | No mobile navigation — 5 nav links + logo + sign-in button sit in one unbreaking flex row with no hamburger/collapse. | `src/components/Navigation.tsx:71-104` |
| 7 | P1 | Create Bot is one long undifferentiated form (name → exchange → pair → order-size % → stop-loss % → API key → secret → passphrase) with no grouping, steps, or inline guidance on where to find exchange keys or what the risk fields mean. | `src/app/bots/create/components/create-bot-form.tsx:224-517` |
| 8 | P1 | First-run dashboard has no unified empty state — a brand-new user sees six separately-loading cards each saying "No trades found / No active positions / No logs / No saved strategies" instead of one guided "create your first bot" moment. | `src/app/dashboard/page.tsx:193-337` |
| 9 | P1 | Error messages are inconsistent: `/strategy` translates errors into plain language, but Bots, Dashboard, Billing and Assets surface raw Supabase/HTTP strings or bare `"Unexpected error"` straight to the UI. | `src/app/bots/page.tsx:33`, `src/app/dashboard/page.tsx:72-73,175-176`, `src/components/billing/billing-overview.tsx:67,94` |
| 10 | P1 | Native blocking `alert()` is used mid-flow instead of the app's own Alert/Toast components, jarring against the rest of the designed UI. | `src/app/bots/create/components/create-bot-form.tsx:140,148` |

---

## 1. Onboarding (landing → sign-up → first login)

**What's good:** the landing page (`src/components/landing/hero.tsx`, `how-it-works.tsx`) explains the product in plain language with a clear 4-step mental model, and the auth screen (`src/app/auth/page.tsx`) is a clean single form with Google sign-in, password confirmation, and inline validation via `react-hook-form`/`zod`.

- **[P2] Vanity stats read as placeholder marketing.** "2,500+ Active Bots", "$10M+ Trading Volume", "99.9% Uptime" (`src/app/auth/page.tsx:177-182`) and "2,500+ Bots launched" (`src/components/landing/hero.tsx:32-34`) are static numbers with no source. A cautious trader evaluating whether to trust the product with exchange keys will notice these never move. **Fix:** either wire them to real aggregate metrics or drop them — unverifiable precision ("99.9%") erodes trust faster than a vaguer claim would.
- **[P2] Weak minimum password (6 chars)** for an account that will hold exchange API keys and, for Hyperliquid, a private key. `src/app/auth/page.tsx:27`, reused in `src/app/profile/page.tsx:30-32`. **Fix:** raise to 8–10 chars with a strength hint, since the blast radius of a compromised account here is a funded exchange account, not just a forum login.
- **[P2] No "why do you need my API key" reassurance at the point of signup.** The marketing page claims "Bank-Level Security" (`src/app/auth/page.tsx:147-149`) but the actual create-bot form (section 2 below) never repeats or substantiates that promise where it matters — right before pasting a secret.
- There is no dedicated onboarding checklist/tour after first login — a brand-new user lands straight on the dashboard, which (see §4) is a wall of empty widgets rather than a "create your first bot" moment.

## 2. Bot creation

`src/app/bots/create/components/create-bot-form.tsx` is the core conversion flow — this is where a trader connects real money. It is functionally complete but has the highest-severity findings in the audit.

- **[P0] Hyperliquid fields are mislabeled.** The exchange registry defines Hyperliquid's credentials as wallet address (`apiKey`) and private key (`apiSecret`) (`src/lib/exchanges/hyperliquid.ts:7-23`), but the form's `FormLabel`/`FormDescription` for both fields is hardcoded to generic exchange language regardless of the selected exchange:
  ```
  FormLabel: "API Key" / FormDescription: "Your exchange API key"   (line 424-434)
  FormLabel: "API Secret" / FormDescription: "Your exchange API secret."  (line 445-465)
  ```
  A non-technical trader who selects Hyperliquid has no indication they are being asked for a wallet address and a **private key** — the single most sensitive credential in crypto. There's no warning about what happens if that key leaks, and no link explaining how to obtain a wallet-only / view-limited key if Hyperliquid supports one.
  **Fix:** make the label/placeholder/description conditional on `form.watch('exchange')`, same pattern already used for the Bitget-only passphrase field at line 471. For Hyperliquid, label the fields "Wallet address" and "Private key" and add a one-line risk note.

- **[P0 — same cluster] The field *shown* doesn't match the field *required*.** The Bitget passphrase field is conditionally rendered (`form.watch('exchange') === 'bitget'`, line 471), but the API Secret field is always shown even though it's functionally unused for some configurations and the schema marks it `optional()` (line 53) while Bitget's exchange client actually requires it. Validation of a missing/wrong secret only happens *after* the bot row is already created and a round-trip to `/api/exchange/validate` fails (lines 159-199) — the user has already seen "creating bot…" succeed once before being told their credentials are wrong.
  **Fix:** make `api_secret` conditionally required per exchange in the zod schema so the error surfaces before any network call, not after an illusory success.

- **[P1] No progressive disclosure.** All eight fields — name, exchange, pair, order-size %, stop-loss %, API key, API secret, passphrase — render at once in a single flat list (lines 287-505) with no grouping into "Basics" vs "Connect your exchange", no step indicator, and no link to "where do I find my Bitget API key" instructions. `ApiDocumentation` (`src/app/bots/create/components/api-documentation.tsx`) sits in a separate column and only shows the *webhook* setup, not exchange-key setup.
  **Fix:** split into two visual steps (bot basics → exchange connection) and add a short help link/tooltip next to the API key field pointing at exchange-specific key-creation docs.

- **[P1] Risk fields have no guardrail copy.** `max_position_size` ("Default order size (% of balance)") defaults to 25% of the account per trade (`ORDER_SIZE.default` in `src/lib/bot-config.ts:13`) with only a one-line description (line 383-385) and no worked example ("25% of a $1,000 balance = $250 per trade"). For a non-technical trader this is the single number most likely to cause real financial pain if misunderstood.
  **Fix:** add a live preview ("≈ $X per order based on your last-seen balance") the way `account-balance.tsx` already fetches balance data elsewhere in this folder.

- **[P1] Blocking native dialogs break the app's own design language.** `alert('User is not logged in. Redirecting to login.')` (lines 140, 148) uses the browser's native alert instead of the `Alert`/toast components used two lines later in the same file.
  **Fix:** replace with the existing `setError` + `<Alert variant="destructive">` pattern already wired up in this component.

- **[P2] Dead/abandoned code in this flow.** `src/app/bots/create/components/strategy-config.tsx` defines a `StrategyConfig` component (Strategy Name / Action / Stop-loss UI) that is never imported anywhere in the app. It signals a half-wired feature left in the create flow and is worth removing so a future contributor doesn't assume it's live.

- **What's good:** the webhook-secret reveal-once pattern (`generatedWebhookSecret`, lines 519-569, and the richer `WebhookSecretSection.tsx`) is well designed — clear single-shot warning, copy button with `window.prompt` clipboard fallback, explicit confirmation step before regenerating a secret that will break existing TradingView alerts (`WebhookSecretSection.tsx:79-84`). This is a model for how the rest of the app's sensitive-data flows should read.

## 3. Pine Script paste (`/strategy`)

This page lets a user paste a Pine v5 script, preview/backtest it against sample or live candles, and optionally save it as a paper strategy attached to a bot (`src/app/strategy/page.tsx`).

- **[P0] It's a developer console wearing a product's nav item.** "Strategies" sits in the top-level navigation next to "Dashboard" and "Bots" (`src/components/Navigation.tsx:85`) with no indication it requires reading/writing code. The page itself:
  - opens on a raw `<textarea>` of Pine source (`page.tsx:105-111`),
  - exposes a `<details>` dump of "Strategy definition (via {engine})" as formatted JSON (`page.tsx:187-190`),
  - renders a results table with ISO 8601 timestamps (`new Date(...).toISOString().slice(0,16)`, `page.tsx:197-198`) rather than localized/human time,
  - labels the page itself "Pine strategy (preview)" with a "Paper mode — no real orders" badge that assumes the reader already knows what "paper mode" means.

  A trader who doesn't write Pine Script will land here from the nav, see a code editor and a JSON blob, and bounce. **Fix (minimum):** either remove this from primary nav and surface it as an advanced/optional feature reachable from a bot's detail page ("Attach a custom strategy — advanced"), or add a non-technical path: a short list of pre-built, named strategies (the four `SAMPLE_PINE` presets already exist and are a good start, lines 100-104) presented as cards with a "Use this strategy" button, with the raw-paste textarea collapsed behind an "I have my own Pine script" toggle for power users.

- **[P1] Inconsistent, best-in-class error copy that doesn't extend elsewhere.** `src/lib/strategy/friendly-error.ts` is genuinely good UX writing — it turns parser errors into actionable, plain-language guidance with the offending line highlighted (e.g. "Write ta.macd as a tuple… Use `[macdLine, signalLine, hist] = ta.macd(...)`"). This quality is not matched anywhere else in the app (see §6) — it's an isolated bright spot rather than a house style.

- **[P2] Timestamps and jargon leak into the trade table.** "via {result.via}", raw ISO datetimes, and a strict JSON dump are all one `<details>` click away from a first-time user even if they never asked for them (`page.tsx:187-204`). Fine for a power user, but there's no simpler default view.

## 4. Dashboard

`src/app/dashboard/page.tsx` stacks six independent cards: KPI row → Recent Trades → Paper Strategies → Active Positions → Market Overview → Trading Insights → Activity Logs.

- **[P1] No first-run state.** Every one of the six cards fetches independently and, for a user with zero bots, independently renders its own "No trades found" / "No active positions" / "No saved strategies yet" / empty table (`dashboard/components/active-positions.tsx:192-224`, `dashboard/page.tsx` via `TradesTable`/`LogsTable` empty rows, `dashboard/components/paper-strategies.tsx:56,74`). The net effect for a brand-new trader is a page that loads six near-identical "nothing here" boxes stacked vertically, with the one meaningful action — "Create Bot" — as a single button at the very top (`dashboard/page.tsx:206-230`), easy to lose in the scroll.
  **Fix:** when the user has zero bots, short-circuit the whole page to one centered empty state ("Create your first bot to see data here") like the pattern already implemented correctly on the Assets page (`src/app/assets/page.tsx:291-317` — see §6, this is the one place in the app that does empty states well).

- **[P1] Too many cards competing for attention on first load.** Even for an active user, six stacked cards (each with its own refresh button, its own loading skeleton style, its own "last 30s/60s" polling) is a lot of competing real-time motion for someone not used to reading market dashboards. Market Overview and Trading Insights in particular (`dashboard/components/market-overview.tsx`, `trading-insights.tsx`) duplicate information available elsewhere (general crypto prices; trade stats also summarized in the KPI row).
  **Fix:** consider collapsing Market Overview and Trading Insights behind a secondary tab ("Insights") and keep the main dashboard to: KPIs → Recent Trades → Active Positions.

- **[P2] Live vs. paper is well-separated at the KPI level but re-mixed below it.** The KPI row correctly keeps "Live P&L" and "Paper P&L" in separate cards with distinct styling (`dashboard/page.tsx:234-257`), but the Recent Trades table directly underneath interleaves live and simulated trades in one list, distinguished only by a small `ModeBadge`/"Simulated" badge (`src/components/trades-table.tsx:143-150`). A trader skimming quickly on a phone could misread a paper gain as a real one.
  **Fix:** either default-filter the combined trades table to "Live" with a toggle for "Include paper", or visually separate the two with a stronger divider than a badge.

## 5. Trade history

`src/components/trades-table.tsx` and `src/components/logs-table.tsx` (used on the dashboard) are the trader's record of what the bot actually did.

- **[P1] Status/side color coding may not be colorblind-safe**, and relies entirely on color with text labels of varying length (`getStatusColor`/`getSideColor`, `trades-table.tsx:54-74`) — acceptable since text is always present, but the green/red pairing for buy/sell and the green/red pairing for P&L sign use the *same* palette for two different semantic axes, which can read as "good/bad" for direction when direction is neutral. Minor, but worth a design pass.
- **[P1] No export/CSV.** For a trader who wants to review performance outside the app (tax reporting, spreadsheet analysis), there is no export control anywhere in `trades-table.tsx` or the dashboard. This is a common expectation for any trade-history view and its absence will generate support requests.
- **[P2] Pagination is small and silent about total scope.** `pageSize = 6` (`trades-table.tsx:42`) with the `.limit(100)` server-side cap in `dashboard/page.tsx:109` means a trader with more than 100 trades silently never sees anything older than the most recent 100 — there's no "showing 100 of N, see all" messaging anywhere.
- **What's good:** the filter input (symbol/side/status/bot name) and refresh button are simple, discoverable, and consistent between `TradesTable` and `LogsTable`; the underlying `ui/table.tsx` component correctly wraps tables in `overflow-auto` (line 9) so these two tables are fine on mobile, unlike the hand-rolled table on the Bots page (§7).

## 6. Errors & empty states

- **[P0] No app-level error/404/loading boundaries.** A repo-wide search found zero `error.tsx`, `not-found.tsx`, or `loading.tsx` files under `src/app`. Every unexpected render error or bad URL (including the dead `/auth/login` link in §2) falls through to Next.js's default, unstyled error screen — the opposite of reassuring for someone about to connect a funded exchange account.
  **Fix:** add a root `src/app/not-found.tsx` and `src/app/error.tsx` with the same visual language as the rest of the app (reuse `page-background`/`page-container` classes from `globals.css:80-90`), plus at minimum a `loading.tsx` for `/dashboard` and `/bots` to replace the inconsistent hand-rolled "Loading…" strings.

- **[P1] Error message quality is inconsistent across the app.** Compare:
  - `src/lib/strategy/friendly-error.ts` — translates technical errors into plain, actionable sentences with highlighted source lines.
  - `src/app/bots/page.tsx:31-35` — `handleError` just does `err instanceof Error ? err.message : 'Unexpected error'` and renders the raw Supabase message directly in a red box (line 99-103). A real-world result here is things like a raw Postgres constraint-violation string shown verbatim to a trader.
  - `src/app/dashboard/page.tsx:71-74,174-177` — logs the real error to console and silently empties the list on failure, with no user-visible message at all (trades/logs just appear blank with no distinction from "you have no trades").
  - `src/components/billing/billing-overview.tsx:61-68` — same raw-message-to-UI pattern for Stripe/subscription errors, which could leak internal error text when the Stripe API call fails.

  **Fix:** introduce one shared "friendly error" mapping (extending the pattern already proven in `friendly-error.ts`) for the handful of common failure modes — not-authenticated, network/timeout, rate-limited, row-not-found, generic 500 — and use it everywhere a raw `error.message`/Supabase error is currently rendered.

- **[P1] Zero-state handling is inconsistent across pages, when it exists at all.**
  - **Good example:** `src/app/assets/page.tsx:291-317` — a proper centered empty state with icon, explanation, and a "Create Your First Bot" CTA.
  - **Missing entirely:** `src/app/bots/page.tsx` — if `bots` is empty, the page renders a table with headers and zero rows (`bots.map(...)` on an empty array, lines 119-159) and no call to action; a first-time user sees an empty table and nothing telling them to click "Create Bot" (there isn't even a Create Bot button on this page at all — only a bare "Your Bots" heading, line 93-97).
  - **Partial:** dashboard cards each render their own "No X found" text with no shared visual treatment or next-step link (§4).

  **Fix:** reuse the Assets page's empty-state component across Bots, Dashboard-when-zero-bots, and Trades/Logs tables, and add a "Create Bot" button to the Bots list page itself — right now `/bots` with zero bots is a dead end.

- **[P2] Destructive confirmation is a hand-rolled modal, not the design system's.** The delete-bot dialog (`src/app/bots/page.tsx:164-190`) is a bespoke `fixed inset-0` overlay with no Escape-to-close, no focus trap, and no `role="dialog"`/`aria-modal` — it's inconsistent with (and less accessible than) the toast/alert components used elsewhere in the app.

## 7. Mobile

- **[P0] Bots list table clips content instead of scrolling.** `src/app/bots/page.tsx:105` wraps a 7-column `<table>` (`min-w-full`, `whitespace-nowrap` cells) in a `div` with `overflow-hidden`. Every other table in the app uses the shared `ui/table.tsx` component, whose wrapper is `overflow-auto` (`src/components/ui/table.tsx:9`) and therefore scrolls correctly — this one page rolled its own markup and got it wrong. On a narrow viewport, the rightmost "Actions" column (View/Pause/Delete — the only interactive controls on the page) is **cut off and inaccessible**, not just awkward to reach.
  **Fix:** either switch this page to the shared `Table`/`TableRow`/`TableCell` primitives, or change `overflow-hidden` to `overflow-x-auto` on the wrapping `div`.

- **[P1] No responsive navigation.** `src/components/Navigation.tsx:71-104` has no breakpoint logic at all — `Dashboard | Bots | Strategies | Assets [| Admin]` plus logo and sign-in/profile menu sit in one `flex` row that will wrap or overflow unpredictably below ~640px, with no hamburger menu.
  **Fix:** add a `md:hidden` hamburger that opens a slide-over/sheet with the same links, collapsing the inline link row to `hidden md:flex`.

- **[P1] Dense data tables throughout the dashboard** (Active Positions has 8 columns, Market Overview has 5, Paper Strategies has 6+5) rely on the generic `overflow-auto` horizontal scroll to be usable on phones. That technically works, but means a trader on a phone is horizontally scrolling through nearly every section of the dashboard — there's no responsive card/stacked layout for small screens anywhere in `src/app/dashboard/components/*`.
  **Fix:** for the 2-3 highest-traffic tables (Recent Trades, Active Positions), add a `sm:hidden` stacked-card view (symbol + side + P&L as a compact row) alongside the existing `hidden sm:block` table, rather than relying on horizontal scroll as the only mobile affordance.

- **[P2] Pine Script textarea and JSON viewer are desktop-first.** The `h-64 w-full` textarea and `font-mono text-xs` JSON `<pre>` on `/strategy` (`src/app/strategy/page.tsx:105-111,189`) are usable on mobile only by zooming/scrolling; combined with finding §3's larger "this is a dev tool" issue, this page is effectively unusable for a non-technical trader on a phone.

---

## Suggested sequencing

1. **Fix the three outright bugs first** (dead `/auth/login` route, `overflow-hidden` table clip, missing `not-found.tsx`/`error.tsx`) — small diffs, no design decisions needed.
2. **Relabel Hyperliquid credential fields and gate `api_secret` per exchange** — security-adjacent, should not wait for a redesign.
3. **Add the Assets-page empty-state pattern to Bots and Dashboard**, and a Create Bot button on `/bots` — reuses existing code, closes the biggest first-run gap.
4. **Extend `friendly-error.ts`'s approach to the rest of the app's error surfaces** — one shared utility, many call sites.
5. **Mobile nav + bots table fix** — together these unblock using the app on a phone at all.
6. Treat the Pine Script page and dashboard information density as a separate, larger design conversation (hiding it from primary nav vs. building a guided version) rather than a quick patch.
