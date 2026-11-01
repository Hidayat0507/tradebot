/**
 * Opt-in END-TO-END test against the Hyperliquid TESTNET (mock USDC, never mainnet).
 *
 *   npx tsx scripts/testnet-e2e.ts            # exits 0 with "SKIP" when creds are missing
 *
 * Env (read from env only, never printed):
 *   HL_TESTNET_WALLET          main wallet address (the one holding mock USDC on testnet)
 *   HL_TESTNET_PRIVATE_KEY     API/agent wallet private key approved for that address on testnet
 *   TESTNET_E2E_BASE_URL       running app, default http://localhost:3000
 *   TESTNET_E2E_BOT_ID         a bot with exchange=hyperliquid, mode='testnet', same creds stored
 *   TESTNET_E2E_WEBHOOK_SECRET that bot's webhook secret
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY   to verify the recorded trades
 *   TESTNET_E2E_SYMBOL (default ETH/USDC:USDC), TESTNET_E2E_USD (default 12; HL min notional is $10)
 *
 * Flow: buy webhook -> order on testnet + trade row -> sell webhook -> trade row with pnl
 *       -> close any leftover position (reduce-only) on testnet.
 */
import * as ccxt from 'ccxt'
import { createClient } from '@supabase/supabase-js'
import { enableTestnet, assertTestnetClient } from '../src/lib/exchanges/testnet'

const env = process.env
const required = ['HL_TESTNET_WALLET', 'HL_TESTNET_PRIVATE_KEY', 'TESTNET_E2E_BOT_ID', 'TESTNET_E2E_WEBHOOK_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = required.filter((k) => !env[k])
if (missing.length) {
  console.log(`SKIP testnet e2e: missing env ${missing.join(', ')}`)
  process.exit(0)
}

const BASE = env.TESTNET_E2E_BASE_URL ?? 'http://localhost:3000'
const SYMBOL = env.TESTNET_E2E_SYMBOL ?? 'ETH/USDC:USDC'
const USD = Number(env.TESTNET_E2E_USD ?? 12)
const BOT_ID = env.TESTNET_E2E_BOT_ID!
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
function check(cond: unknown, msg: string): asserts cond { if (!cond) throw new Error(`FAIL: ${msg}`); console.log(`ok  - ${msg}`) }

const hl = enableTestnet(new ccxt.hyperliquid({ walletAddress: env.HL_TESTNET_WALLET, privateKey: env.HL_TESTNET_PRIVATE_KEY, enableRateLimit: true }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function webhook(action: 'buy' | 'sell', amount: number, price: number, alertId: string) {
  const res = await fetch(`${BASE}/api/webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bot_id: BOT_ID, secret: env.TESTNET_E2E_WEBHOOK_SECRET, symbol: SYMBOL, action, amount, price, alert_id: alertId, ts: new Date().toISOString() }),
  })
  const text = await res.text()
  check(res.ok, `webhook ${action} accepted (HTTP ${res.status})${res.ok ? '' : ': ' + text.slice(0, 200)}`)
}

async function tradeRow(side: 'buy' | 'sell', since: string) {
  for (let i = 0; i < 20; i++) {
    const { data } = await db.from('trades').select('id, external_id, side, status, size, price, pnl, created_at')
      .eq('bot_id', BOT_ID).eq('side', side).gte('created_at', since).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (data) return data
    await sleep(1500)
  }
  return null
}

async function positionSize() {
  const ps = await hl.fetchPositions([SYMBOL])
  return ps.reduce((s, p) => s + Number(p.contracts ?? 0) * (p.side === 'short' ? -1 : 1), 0)
}

async function main() {
  const { data: bot } = await db.from('bots').select('mode, exchange').eq('id', BOT_ID).single()
  check(bot?.mode === 'testnet' && bot?.exchange === 'hyperliquid', 'bot is a hyperliquid bot in testnet mode')
  assertTestnetClient(hl)
  await hl.loadMarkets()
  const bal = await hl.fetchBalance()
  check(Number((bal.total as unknown as Record<string, number> | undefined)?.USDC ?? 0) >= USD, `testnet account has >= ${USD} mock USDC`)
  const before = await positionSize()
  const { last } = await hl.fetchTicker(SYMBOL)
  check(last && last > 0, `testnet price for ${SYMBOL}`)
  const amount = Number(hl.amountToPrecision(SYMBOL, (USD / last!) * 1.05))
  const since = new Date(Date.now() - 5000).toISOString()
  const run = Date.now().toString(36)

  try {
    await webhook('buy', amount, last!, `e2e-${run}-buy`)
    const buy = await tradeRow('buy', since)
    check(buy && buy.external_id && !String(buy.external_id).startsWith('paper-'), 'buy trade recorded with a real exchange order id')
    const order = await hl.fetchOrder(String(buy!.external_id), SYMBOL)
    check(order?.id, `order ${order.id} found on Hyperliquid TESTNET (status ${order.status})`)
    check((await positionSize()) > before, 'testnet position increased')

    const { last: p2 } = await hl.fetchTicker(SYMBOL)
    await webhook('sell', amount, p2!, `e2e-${run}-sell`)
    const sell = await tradeRow('sell', since)
    check(sell && sell.status, `sell trade recorded (status ${sell?.status})`)
    check(sell!.pnl !== null && Number.isFinite(Number(sell!.pnl)), `pnl recorded (${sell!.pnl})`)
  } finally {
    const left = await positionSize().catch(() => 0)
    const extra = left - before
    if (Math.abs(extra) > 0) {
      const { last: p3 } = await hl.fetchTicker(SYMBOL)
      await hl.createOrder(SYMBOL, 'market', extra > 0 ? 'sell' : 'buy', Math.abs(extra), p3, { reduceOnly: true })
      console.log(`cleanup: closed leftover ${extra} ${SYMBOL} on testnet`)
    }
  }
  console.log('PASS testnet e2e')
}

main().catch((e) => { console.error(e instanceof Error ? e.message : 'testnet e2e failed'); process.exit(1) })
