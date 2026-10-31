import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), encrypt: vi.fn(), validate: vi.fn() }))
vi.mock('@/utils/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/utils/encryption', () => ({ encrypt: mocks.encrypt }))
vi.mock('@/app/api/_middleware/exchange', () => ({ validateExchangeCredentials: mocks.validate }))
vi.mock('ccxt', () => ({ default: {} }))
vi.mock('@/lib/logging', () => ({
  logger: { error: vi.fn(), info: vi.fn() }, normalizeError: (error: unknown) => error,
}))
import { POST } from '@/app/api/bots/route'

const payload = {
  name: 'Test bot', exchange: 'bitget', pair: 'BTC/USDT',
  api_key: 'test-key', api_secret: 'test-secret', password: 'test-passphrase',
  max_position_size: 0.01, user_id: 'attacker', id: 'attacker-id',
}
function request(body: Record<string, unknown> = payload) {
  return new NextRequest('http://localhost/api/bots', { method: 'POST', body: JSON.stringify(body) })
}
function setup(options: { authenticated?: boolean; count?: number | null; subscription?: unknown; subscriptionError?: unknown; countError?: unknown } = {}) {
  const subscriptionEq = vi.fn().mockReturnThis()
  const subscription = { select: vi.fn().mockReturnThis(), eq: subscriptionEq,
    maybeSingle: vi.fn().mockResolvedValue({ data: options.subscription ?? null, error: options.subscriptionError }) }
  const countEq = vi.fn().mockResolvedValue({ count: options.count === undefined ? 0 : options.count, error: options.countError })
  const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'saved-id' }, error: null }) }) })
  const from = vi.fn((table: string) => table === 'user_subscriptions' ? subscription : { select: vi.fn().mockReturnValue({ eq: countEq }), insert })
  const getUser = vi.fn().mockResolvedValue({ data: { user: options.authenticated === false ? null : { id: 'owner', email: 'owner@example.test' } }, error: null })
  mocks.createClient.mockResolvedValue({ auth: { getUser }, from })
  return { from, insert, subscriptionEq, countEq }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('TRADING_MODE', 'live')
  mocks.validate.mockReset()
  mocks.validate.mockResolvedValue(undefined)
  vi.stubEnv('ADMIN_EMAILS', '')
  vi.stubEnv('NEXT_PUBLIC_ADMIN_EMAILS', '')
  mocks.encrypt.mockImplementation(async (value: string) => `encrypted:${value}`)
})
afterEach(() => vi.unstubAllEnvs())
describe('POST /api/bots', () => {
  it('rejects unauthenticated requests before querying or inserting', async () => {
    const db = setup({ authenticated: false })
    expect((await POST(request())).status).toBe(401)
    expect(db.from).not.toHaveBeenCalled()
    expect(mocks.encrypt).not.toHaveBeenCalled()
  })
  it.each([
    { count: 5, subscription: null },
    { count: 25, subscription: { plan: 'pro', max_bots: 25 } },
    { count: 2, subscription: { plan: 'custom', max_bots: 2 } },
  ])('enforces server plan limit: %j', async (options) => {
    const db = setup(options)
    expect((await POST(request())).status).toBe(403)
    expect(db.subscriptionEq).toHaveBeenCalledWith('user_id', 'owner')
    expect(db.countEq).toHaveBeenCalledWith('user_id', 'owner')
    expect(db.insert).not.toHaveBeenCalled()
    expect(mocks.encrypt).not.toHaveBeenCalled()
  })
  it.each([{ subscriptionError: new Error('offline') }, { countError: new Error('offline') }, { count: null }])('fails closed if usage cannot be verified: %j', async (options) => {
    const db = setup(options)
    expect((await POST(request())).status).toBe(500)
    expect(db.insert).not.toHaveBeenCalled()
  })
  it.each(['api_key', 'api_secret', 'password'])('rejects a missing Bitget %s', async (field) => {
    const db = setup()
    expect((await POST(request({ ...payload, [field]: '   ' }))).status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
    expect(mocks.validate).not.toHaveBeenCalled()
  })
  it('rejects invalid credentials before encryption or insertion without leaking errors', async () => {
    const db = setup()
    mocks.validate.mockRejectedValue(new Error('sensitive exchange response'))
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain('sensitive')
    expect(db.insert).not.toHaveBeenCalled()
    expect(mocks.encrypt).not.toHaveBeenCalled()
  })
  it.each(['env', 'bot'])('skips exchange validation for paper mode (%s)', async (source) => {
    const db = setup()
    vi.stubEnv('TRADING_MODE', source === 'env' ? 'paper' : 'live')
    expect((await POST(request({ ...payload, mode: source === 'bot' ? 'paper' : 'live' }))).status).toBe(201)
    expect(mocks.validate).not.toHaveBeenCalled()
    expect(db.insert.mock.calls[0][0].mode).toBe(source === 'bot' ? 'paper' : 'live')
  })
  it('rejects an invalid mode', async () => {
    const db = setup()
    expect((await POST(request({ ...payload, mode: 'invalid' }))).status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })
  it('creates below the plan limit with server ownership, UUID and encrypted secrets', async () => {
    const db = setup({ count: 4 })
    const response = await POST(request())
    expect(response.status).toBe(201)
    expect(mocks.validate).toHaveBeenCalledWith('bitget', 'test-key', 'test-secret', 'test-passphrase')
    const inserted = db.insert.mock.calls[0][0]
    expect(inserted).toMatchObject({ user_id: 'owner', api_secret: 'encrypted:test-secret', password: 'encrypted:test-passphrase', enabled: false })
    expect(inserted.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(inserted.webhook_secret).toMatch(/^sha256:[0-9a-f]{64}$/)
    const body = await response.json()
    expect(body.data.webhookSecret).toMatch(/^[0-9a-f]{64}$/)
    expect(body.data).not.toHaveProperty('api_secret')
    expect(body.data).not.toHaveProperty('password')
  })
})
