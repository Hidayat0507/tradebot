/** Real HTTP + Auth + PostgREST + Postgres/RLS, restricted to the local Docker stack. */
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, openSync, closeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { localEnv, localKeys, migrateLocal, root, startLocal, testLocalDb } from './local-supabase'

const base = 'http://127.0.0.1:3100'
const pine = 'strategy("Local e2e")\nfast = ta.sma(close, 5)\nslow = ta.sma(close, 20)\nif ta.crossover(fast, slow)\n    strategy.entry("L", strategy.long)\nif ta.crossunder(fast, slow)\n    strategy.close("L")'
let checks = 0
function check(value: unknown, label: string): asserts value {
  assert.ok(value, label)
  console.log(`ok ${++checks} - ${label}`)
}
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function main() {
  startLocal()
  migrateLocal()
  testLocalDb()
  const keys = localKeys() // Local keys stay in memory and the child environment.
  const admin = createClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } })
  const anon = createClient(keys.url, keys.anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const users: string[] = []
  // Refuse an existing app; this suite must own the process and enforce paper mode.
  try {
    await fetch(base, { signal: AbortSignal.timeout(1000) })
    throw new Error('Port 3100 is occupied; stop that app before running local e2e')
  } catch (error) {
    if ((error as Error).message.startsWith('Port 3100')) throw error
  }
  const logDirectory = mkdtempSync(resolve(tmpdir(), 'tradebot-local-e2e-'))
  const logPath = resolve(logDirectory, 'app.log')
  const log = openSync(logPath, 'w', 0o600)
  const app = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3100'], {
    cwd: root, detached: true, stdio: ['ignore', log, log],
    env: {
      ...localEnv, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
      NODE_OPTIONS: `--experimental-websocket --require=${resolve(root, 'scripts/local-e2e-network-guard.cjs')}`,
      TRADING_MODE: 'paper', PINE_AI_CONVERTER: 'off', ADMIN_EMAILS: '',
      NEXT_PUBLIC_SUPABASE_URL: keys.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon,
      SUPABASE_SERVICE_ROLE_KEY: keys.service, ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      CRON_SECRET: randomBytes(32).toString('hex'),
    },
  })
  closeSync(log)
  app.on('error', () => { console.error('Local app could not start') })
  const exited = once(app, 'exit')

  const request = async (path: string, cookie = '', method = 'GET', body?: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json', Cookie: cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: 'manual', signal: AbortSignal.timeout(120_000),
    })
    const data = response.status === 204 ? null : await response.json().catch(() => null)
    return { status: response.status, data, location: response.headers.get('location') }
  }

  async function user() {
    const email = `local-${randomUUID()}@example.test`
    const password = randomBytes(24).toString('base64url')
    const client = createClient(keys.url, keys.anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const signup = await client.auth.signUp({ email, password })
    assert.equal(signup.error, null, 'local signup succeeds')
    assert.ok(signup.data.user)
    const id = signup.data.user.id
    users.push(id)
    check((await client.auth.signInWithPassword({ email, password: 'incorrect-password' })).error, 'invalid password rejected')
    const cookies = new Map<string, string>()
    const browser = createServerClient(keys.url, keys.anon, { cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (items: { name: string; value: string; options: CookieOptions }[]) => { for (const item of items) cookies.set(item.name, item.value) },
    } })
    const signin = await browser.auth.signInWithPassword({ email, password })
    assert.equal(signin.error, null, 'local password login succeeds')
    assert.ok(signin.data.session)
    await client.auth.setSession(signin.data.session)
    check((await browser.auth.getUser()).data.user?.id === id, 'Auth verifies signed-in user')
    return { id, client, cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '), token: signin.data.session.access_token }
  }

  try {
    let ready = false
    for (let i = 0; i < 120; i++) {
      if (app.exitCode !== null) break
      try { if ((await fetch(`${base}/api/bots`, { signal: AbortSignal.timeout(2000) })).status === 401) { ready = true; break } } catch {}
      await wait(500)
    }
    check(ready, 'isolated Next.js app ready in paper mode')
    const a = await user()
    const b = await user()
    check((await request('/api/bots')).status === 401, 'anonymous bot API rejected')
    check((await request('/dashboard')).location?.endsWith('/auth'), 'anonymous dashboard redirects to auth')
    check((await request('/dashboard', a.cookie)).status === 200, 'authenticated dashboard renders')
    check((await request('/admin', a.cookie)).location?.endsWith('/dashboard'), 'non-admin blocked from admin page')

    const createBot = async (cookie: string, name: string) => {
      const response = await request('/api/bots', cookie, 'POST', {
        name, exchange: 'hyperliquid', pair: 'ETH/USDC:USDC', max_position_size: 0.01,
        enabled: true, api_key: 'local-dummy-key', api_secret: 'local-dummy-secret',
      })
      check(response.status === 201, 'bot created through authenticated API')
      return response.data.data as { id: string; webhook_secret: string }
    }
    const botA = await createBot(a.cookie, 'Local A')
    const botB = await createBot(b.cookie, 'Local B')
    for (const bot of [botA, botB]) {
      assert.equal((await admin.from('bots').update({ mode: 'paper' }).eq('id', bot.id)).error, null)
    }
    const stored = await admin.from('bots').select('api_secret, webhook_secret').eq('id', botA.id).single()
    check(stored.data?.api_secret.startsWith('v1:') && stored.data?.webhook_secret.startsWith('sha256:'), 'credentials encrypted and webhook secret hashed at rest')
    check((await request('/api/bots', a.cookie)).data.data.every((row: { user_id: string }) => row.user_id === a.id), 'bot list contains only the signed-in owner')
    check((await request(`/api/bots/${botB.id}`, a.cookie)).status === 404, 'cross-owner bot API read rejected')
    check((await request(`/api/bots/${botB.id}`, a.cookie, 'PUT', { name: 'forbidden' })).status === 404, 'cross-owner bot API update rejected')
    check((await request(`/api/bots/${botB.id}`, a.cookie, 'DELETE')).status === 404, 'cross-owner bot API delete rejected')
    check((await request(`/api/bots/${botA.id}`, a.cookie, 'PUT', { name: 'Renamed', user_id: b.id })).status === 200, 'owner can update editable fields')
    check((await admin.from('bots').select('user_id').eq('id', botA.id).single()).data?.user_id === a.id, 'API ignores forged ownership changes')

    const preview = await request('/api/strategy/preview', a.cookie, 'POST', { pine, candles: 'sample' })
    check(preview.status === 200 && preview.data.ok, 'Pine preview backtests sample candles without exchange access')
    const strategyPath = `/api/bots/${botA.id}/strategy`
    const saved = await request(strategyPath, a.cookie, 'PUT', { pine })
    check(saved.status === 200 && saved.data.data.mode === 'paper' && saved.data.data.enabled === false, 'strategy saves as paper and disabled')
    check((await request(strategyPath, b.cookie)).status === 404, 'cross-owner strategy API rejected')
    check((await request(strategyPath, a.cookie, 'PUT', { pine, enabled: true })).status === 200, 'owner can update saved strategy')

    // Test PostgREST with actual user JWTs, without API ownership filters.
    const assertOwnRows = async (client: SupabaseClient, table: string, userId: string) => {
      const result = await client.from(table).select('user_id')
      assert.equal(result.error, null, `select ${table}`)
      check(result.data!.length > 0 && result.data!.every(row => row.user_id === userId), `${table}: RLS restricts JWT reads to owner`)
    }
    await assertOwnRows(a.client, 'bots', a.id)
    await assertOwnRows(a.client, 'bot_strategies', a.id)
    const hidden = await a.client.from('bots').update({ name: 'forbidden' }).eq('id', botB.id).select('id')
    check(!hidden.error && hidden.data?.length === 0, 'RLS cross-owner update affects no rows')
    const hiddenDelete = await a.client.from('bots').delete().eq('id', botB.id).select('id')
    check(!hiddenDelete.error && hiddenDelete.data?.length === 0, 'RLS cross-owner delete affects no rows')
    check((await a.client.from('bots').insert({ user_id: b.id, name: 'spoof', exchange: 'hyperliquid', pair: 'ETH/USDC:USDC', max_position_size: 1 })).error, 'RLS rejects forged owner insert')
    check((await a.client.from('bot_strategies').insert({ bot_id: botB.id, user_id: a.id, pine_source: pine, definition: {} })).error, 'strategy RLS rejects attaching another owner bot')
    check((await a.client.from('bot_strategies').update({ last_candle_time: new Date().toISOString() }).eq('bot_id', botA.id)).error, 'strategy cursor is server-owned')
    for (const field of ['api_key', 'api_secret', 'password', 'webhook_secret']) {
      check((await a.client.from('bots').update({ [field]: 'forbidden' }).eq('id', botA.id)).error, `direct credential write denied: ${field}`)
    }
    for (const table of ['bots', 'trades', 'logs', 'bot_strategies', 'signals']) {
      check((await anon.from(table).select('*')).error, `anonymous table access denied: ${table}`)
    }
    check((await a.client.from('signals').select('*')).error, 'authenticated clients cannot read replay claims')

    const payload = { bot_id: botA.id, secret: botA.webhook_secret, symbol: 'ETH/USDC:USDC',
      action: 'buy', amount: 0.01, price: 3000, ts: new Date().toISOString(), alert_id: randomUUID() }
    check((await request('/api/webhook', '', 'POST', { ...payload, secret: 'incorrect' })).status === 401, 'webhook rejects invalid secret')
    check((await request('/api/webhook', '', 'POST', { ...payload, ts: '2000-01-01T00:00:00Z' })).status === 400, 'webhook rejects stale timestamp')
    const buy = await request('/api/webhook', '', 'POST', payload)
    check(buy.status === 200 && buy.data.data.trade.external_id.startsWith('paper-'), 'paper buy persists simulated fill through real database')
    check((await request('/api/webhook', '', 'POST', payload)).status === 409, 'durable replay claim rejects duplicate webhook')
    const sell = await request('/api/webhook', '', 'POST', { ...payload, action: 'sell', price: 3100, alert_id: randomUUID(), ts: new Date().toISOString() })
    check(sell.status === 200 && sell.data.data.trade.pnl === 1, 'paper sell persists calculated PnL')
    await assertOwnRows(a.client, 'trades', a.id)
    check((await b.client.from('trades').select('id').eq('bot_id', botA.id)).data?.length === 0, 'other user cannot read paper fills')
    for (const user of [a, b]) {
      assert.equal((await admin.from('logs').insert({ user_id: user.id, bot_id: user.id === a.id ? botA.id : botB.id, type: 'info', message: 'local fixture' })).error, null)
      assert.equal((await admin.from('user_subscriptions').insert({ user_id: user.id, plan: 'free' })).error, null)
    }
    await assertOwnRows(a.client, 'logs', a.id)
    await assertOwnRows(a.client, 'user_subscriptions', a.id)
    await a.client.from('user_subscriptions').update({ plan: 'pro' }).eq('user_id', a.id)
    check((await admin.from('user_subscriptions').select('plan').eq('user_id', a.id).single()).data?.plan === 'free', 'subscription plan cannot be elevated by client')
    const dashboard = await request('/api/strategy/dashboard', a.cookie)
    check(dashboard.status === 200 && dashboard.data.data.strategies.length === 1 && dashboard.data.data.trades.length === 2, 'strategy dashboard returns owner strategy and paper fills')
    check((await request('/api/cron/paper-strategies')).status === 401, 'scheduler rejects missing cron authorization')
    check((await request(strategyPath, a.cookie, 'DELETE')).status === 200, 'owner can delete strategy')
    check((await request(`/api/bots/${botA.id}`, a.cookie, 'DELETE')).status === 204, 'owner can delete bot')
    check((await admin.from('trades').select('id').eq('bot_id', botA.id)).data?.length === 0, 'bot deletion cascades to paper fills')
    assert.equal((await a.client.auth.signOut()).error, null)
    check((await a.client.auth.getSession()).data.session === null, 'sign-out clears local auth session')
    console.log(`PASS: ${checks} local e2e checks plus pgTAP owner/RLS suite; no external connections allowed.`)
  } finally {
    for (const id of users) {
      const result = await admin.auth.admin.deleteUser(id)
      if (result.error) console.error('Local fixture cleanup failed (user details omitted).')
    }
    if (app.pid) {
      try { process.kill(-app.pid, 'SIGTERM') } catch {}
      await Promise.race([exited, wait(5000)])
      try { process.kill(-app.pid, 'SIGKILL') } catch {}
    }
    console.log(`Local app log (private): ${logPath}`)
  }
}
main().catch(error => { console.error(`FAIL: ${(error as Error).message}`); process.exitCode = 1 })
