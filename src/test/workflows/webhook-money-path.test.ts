import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  selectBot: vi.fn(), from: vi.fn(), insertSignal: vi.fn(), insertTrade: vi.fn(), constructor: vi.fn(),
  createOrder: vi.fn(), fetchBalance: vi.fn(),
}))
vi.mock('ccxt', () => ({ bitget: mocks.constructor, hyperliquid: mocks.constructor }))
vi.mock('@/utils/supabase/server', () => ({
  createServiceClient: () => ({ from: mocks.from }), createClient: vi.fn(),
}))
import { POST } from '@/app/api/webhook/route'
import { executeTrade, isPaperMode, signalClientOrderId } from '@/app/api/_middleware/webhook/execute-trade'
import type { ExchangeClient } from '@/types/exchange'

const bot = { id: 'bot1', exchange: 'bitget', api_key: 'fake', api_secret: 'fake',
  user_id: 'user1', webhook_secret: 'test-secret', name: 'test', enabled: true }
const payload = () => ({ bot_id: bot.id, secret: 'test-secret', symbol: 'BTC/USDT',
  action: 'buy', ts: new Date().toISOString(), alert_id: 'event1', amount: 0.01, price: 50000 })
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/webhook', {
  method: 'POST', body: JSON.stringify(body),
}))

// Freeze the clock: the replay-window checks compare against Date.now(). With a real clock the
// "+61s" case only had a 1s margin, so under a loaded box (>1s between building the payload and
// validating it) it slid back inside the 60s window and flaked.
const FROZEN_NOW = new Date('2026-10-31T08:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FROZEN_NOW)
  vi.clearAllMocks()
  vi.stubEnv('TRADING_MODE', 'paper')
  vi.stubEnv('WEBHOOK_REPLAY_WINDOW_SECONDS', '60')
  mocks.selectBot.mockImplementation(() => ({ eq: () => ({ single: async () => ({ data: bot, error: null }) }) }))
  mocks.insertSignal.mockResolvedValue({ error: null })
  mocks.insertTrade.mockImplementation((trade) => ({ select: () => ({ single: async () => ({ data: { id: 'trade1', ...trade }, error: null }) }) }))
  mocks.from.mockImplementation((table: string) => {
    if (table === 'bots') return { select: mocks.selectBot }
    if (table === 'signals') return { insert: mocks.insertSignal }
    if (table === 'trades') return { insert: mocks.insertTrade }
    throw new Error(`Unexpected table ${table}`)
  })
})

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

describe('webhook money path in paper mode', () => {
  it('claims the signal before saving a simulated fill without exchange calls', async () => {
    const response = await post(payload())
    expect(response.status).toBe(200)
    expect((await response.json()).data.trade.external_id).toMatch(/^paper-/)
    expect(mocks.insertSignal.mock.invocationCallOrder[0]).toBeLessThan(mocks.insertTrade.mock.invocationCallOrder[0])
    expect(mocks.constructor).not.toHaveBeenCalled()
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })
  it.each([-60, 60])('accepts timestamps exactly on the window edge (%s seconds)', async (offset) => {
    expect((await post({ ...payload(), ts: new Date(Date.now() + offset * 1000).toISOString() })).status).toBe(200)
  })
  it('is immune to slow processing between building and validating the alert', async () => {
    const body = { ...payload(), ts: new Date(Date.now() + 61_000).toISOString() }
    vi.setSystemTime(FROZEN_NOW.getTime() + 5_000) // simulate a 5s stall under load
    expect((await post(body)).status).toBe(200) // +56s from "now" → inside window, deterministically
    vi.setSystemTime(FROZEN_NOW)
    expect((await post({ ...body, alert_id: 'e2' })).status).toBe(400)
  })
  it.each([-61, 61])('rejects timestamps outside the window (%s seconds)', async (offset) => {
    expect((await post({ ...payload(), ts: new Date(Date.now() + offset * 1000).toISOString() })).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('returns 409 for a duplicate without trading', async () => {
    mocks.insertSignal.mockResolvedValue({ error: { code: '23505' } })
    expect((await post(payload())).status).toBe(409)
    expect(mocks.insertTrade).not.toHaveBeenCalled()
    expect(mocks.constructor).not.toHaveBeenCalled()
  })
  it('fails closed when claiming fails', async () => {
    mocks.insertSignal.mockResolvedValue({ error: { code: '42501' } })
    expect((await post(payload())).status).toBe(500)
    expect(mocks.insertTrade).not.toHaveBeenCalled()
  })
  it('rejects a bad secret before claiming', async () => {
    expect((await post({ ...payload(), secret: 'wrong' })).status).toBe(401)
    expect(mocks.insertSignal).not.toHaveBeenCalled()
  })
  it.each(['ts', 'alert_id'])('rejects missing %s', async (field) => {
    const body: Record<string, unknown> = payload()
    delete body[field]
    expect((await post(body)).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('fetches and honors persisted bot paper mode through POST with a live environment', async () => {
    vi.stubEnv('TRADING_MODE', 'live')
    mocks.selectBot.mockImplementation((columns: string) => ({
      eq: () => ({ single: async () => ({
        data: { ...bot, ...(columns.split(',').map(column => column.trim()).includes('mode') ? { mode: 'paper' } : {}) },
        error: null,
      }) }),
    }))
    const response = await post(payload())
    expect(response.status).toBe(200)
    expect((await response.json()).data.trade.external_id).toMatch(/^paper-/)
    expect(mocks.constructor).not.toHaveBeenCalled()
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })
  it.each([
    ['missing amount', { amount: undefined }],
    ['zero amount', { amount: 0 }],
    ['negative amount', { amount: -1 }],
    ['invalid amount', { amount: 'invalid' }],
    ['missing price', { price: undefined }],
    ['zero price', { price: 0 }],
    ['negative price', { price: -1 }],
    ['invalid price', { price: 'invalid' }],
  ])('returns 400 for paper alerts with %s', async (_label, changes) => {
    expect((await post({ ...payload(), ...changes })).status).toBe(400)
    expect(mocks.insertTrade).not.toHaveBeenCalled()
    expect(mocks.constructor).not.toHaveBeenCalled()
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })
  it('honors a configurable replay window', async () => {
    vi.stubEnv('WEBHOOK_REPLAY_WINDOW_SECONDS', '120')
    expect((await post({ ...payload(), ts: new Date(Date.now() - 90000).toISOString() })).status).toBe(200)
  })
})

describe('deterministic CCXT order IDs (mock orders only)', () => {
  it('honors bot paper mode even when the environment is live', async () => {
    vi.stubEnv('TRADING_MODE', 'live')
    const result = await executeTrade(
      { createOrder: mocks.createOrder } as unknown as ExchangeClient,
      { ...payload(), action: 'buy' }, 50000, { ...bot, mode: 'paper' }
    )
    expect(result.order.id).toMatch(/^paper-/)
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })
  it('uses the explicit test harness paper default', async () => {
    const result = await executeTrade(
      {} as ExchangeClient, { ...payload(), action: 'buy' }, 50000, bot
    )
    expect(result.order.filled).toBe(0.01)
  })
  it('does not infer paper mode from NODE_ENV=test when TRADING_MODE is unset', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TRADING_MODE', undefined)
    expect(isPaperMode(bot)).toBe(false)
  })
  it.each(['bitget', 'hyperliquid'])('passes clientOrderId to %s on both sizing paths', async (exchange) => {
    vi.stubEnv('TRADING_MODE', 'live')
    const client = { id: exchange, createOrder: mocks.createOrder, fetchBalance: mocks.fetchBalance }
    mocks.createOrder.mockResolvedValue({ id: 'mock-only' })
    mocks.fetchBalance.mockResolvedValue({ USDT: { free: 100 }, USDC: { free: 100 } })
    const alert = { ...payload(), action: 'buy' as const }
    for (const amount of [0.01, undefined]) {
      await executeTrade(client as unknown as ExchangeClient, { ...alert, amount }, 50000, { ...bot, exchange })
      expect(mocks.createOrder.mock.lastCall?.[5]).toMatchObject({ clientOrderId: signalClientOrderId(bot.id, alert.alert_id, exchange) })
    }
    expect(signalClientOrderId(bot.id, alert.alert_id, exchange)).toMatch(exchange === 'hyperliquid' ? /^0x[0-9a-f]{32}$/ : /^[0-9a-f]{32}$/)
  })
})
