import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  decrypt: vi.fn(), single: vi.fn(), getUser: vi.fn(), client: vi.fn(), order: vi.fn(),
}))
vi.mock('ccxt', () => {
  class ExchangeError extends Error {}
  return { bitget: mocks.client, hyperliquid: mocks.client, AuthenticationError: ExchangeError,
    PermissionDenied: ExchangeError, RateLimitExceeded: ExchangeError, NetworkError: ExchangeError, ExchangeError }
})
vi.mock('@/app/api/_middleware/webhook/save-trade', () => ({ saveTrade: vi.fn(async (_db, _user, _bot, order) => order) }))
vi.mock('@/utils/encryption', () => ({ decrypt: mocks.decrypt }))
vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, normalizeError: (e: unknown) => e }))
vi.mock('@/utils/supabase/server', () => {
  const query = { select() { return query }, eq() { return query }, single: mocks.single, insert: vi.fn(async () => ({ error: null })) }
  const client = { from: vi.fn(() => query), auth: { getUser: mocks.getUser } }
  return { createServiceClient: vi.fn(() => client), createClient: vi.fn(async () => client) }
})
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn(() => ({ auth: { getUser: mocks.getUser } })) }))

import { POST } from '@/app/api/webhook/route'
import { middleware } from '@/middleware'
import { rateLimiter, MemoryRateLimiter } from '@/lib/rate-limit'
import { resolveExchangeCredentials } from '@/app/api/_middleware/exchange-middleware'
import { getExchangeCredentials } from '@/utils/key-management'
import { isAdminUser } from '@/lib/subscriptions'

let ip = 0
function webhook(secret = 'correct', bot = 'bot', address = `test-${++ip}`) {
  return new NextRequest('http://localhost/api/webhook', { method: 'POST',
    headers: { 'x-forwarded-for': address, 'content-type': 'application/json' },
    body: JSON.stringify({ bot_id: bot, secret, symbol: 'BTC/USDT', action: 'buy', price: 100, amount: 2,
      ts: new Date().toISOString(), alert_id: `a-${ip}` }) })
}
const bot = { id: 'bot', exchange: 'bitget', api_key: 'test', api_secret: 'encrypted',
  webhook_secret: 'correct', enabled: true, user_id: 'user', name: 'test' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('TRADING_MODE', 'paper')
  mocks.single.mockResolvedValue({ data: bot, error: null })
  mocks.decrypt.mockResolvedValue('decrypted')
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  mocks.client.mockImplementation(() => ({ createOrder: mocks.order }))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

describe('webhook security', () => {
  it('fails closed on decryption failure without initializing an exchange or trading', async () => {
    vi.stubEnv('TRADING_MODE', 'live')
    mocks.decrypt.mockRejectedValue(new Error('invalid ciphertext'))
    const response = await POST(webhook())
    expect(response.status).toBe(500)
    expect(mocks.decrypt).toHaveBeenCalled()
    expect(mocks.client).not.toHaveBeenCalled()
    expect(mocks.order).not.toHaveBeenCalled()
  })
  it.each(['apiSecret', 'password'] as const)('rejects undecryptable %s', async field => {
    mocks.decrypt.mockRejectedValue(new Error('invalid'))
    await expect(resolveExchangeCredentials('bitget', { apiKey: 'test', [field]: 'raw' })).rejects.toThrow('Failed to decrypt')
  })
  it.each(['apiSecret', 'password'] as const)('rejects an empty decrypted %s', async field => {
    mocks.decrypt.mockResolvedValue('')
    await expect(resolveExchangeCredentials('bitget', { apiKey: 'test', [field]: 'encrypted' })).rejects.toThrow('Failed to decrypt')
    expect(mocks.client).not.toHaveBeenCalled()
    expect(mocks.order).not.toHaveBeenCalled()
  })
  it('rejects a bad secret without decryption or trading', async () => {
    const response = await POST(webhook('bad'))
    expect(response.status, JSON.stringify(await response.json())).toBe(401)
    expect(mocks.decrypt).not.toHaveBeenCalled()
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it('simulates a paper fill without exchange calls', async () => {
    const response = await POST(webhook())
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
    expect((await response.json()).data.trade).toMatchObject({ amount: 2, price: 100 })
    expect((await POST(webhook())).status).toBe(200)
    expect(mocks.client).not.toHaveBeenCalled()
    expect(mocks.order).not.toHaveBeenCalled()
  })
  it('returns 429 per bot even across different IPs', async () => {
    const id = 'limited-bot'
    for (let n = 0; n < 30; n++) await rateLimiter.consume(`webhook:bot:${id}`, 30, 60000)
    expect((await POST(webhook('correct', id))).status).toBe(429)
    expect(mocks.single).not.toHaveBeenCalled()
  })
  it('returns 429 per IP before parsing or database access', async () => {
    for (let n = 0; n < 60; n++) await rateLimiter.consume('webhook:ip:limited-ip', 60, 60000)
    expect((await POST(webhook('correct', 'other', 'limited-ip'))).status).toBe(429)
    expect(mocks.single).not.toHaveBeenCalled()
  })
  it('expires limiter windows', async () => {
    const limiter = new MemoryRateLimiter()
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
    expect(await limiter.consume('key', 1, 100)).toBe(true)
    expect(await limiter.consume('key', 1, 100)).toBe(false)
    now.mockReturnValue(1100)
    expect(await limiter.consume('key', 1, 100)).toBe(true)
  })
})

describe('middleware security', () => {
  it.each(['/admin', '/logs', '/billing', '/assets', '/bots/123'])('redirects unauthenticated %s using getUser', async path => {
    const response = await middleware(new NextRequest(`http://localhost${path}`))
    expect(response.headers.get('location')).toBe('http://localhost/auth')
    expect(mocks.getUser).toHaveBeenCalledOnce()
  })
  it('rejects a failed verified-user lookup', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { email: 'admin@test' } }, error: new Error('invalid') })
    expect((await middleware(new NextRequest('http://localhost/assets'))).headers.get('location')).toBe('http://localhost/auth')
  })
  it('allows verified users on protected pages', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { email: 'user@test' } }, error: null })
    expect((await middleware(new NextRequest('http://localhost/assets'))).headers.get('location')).toBeNull()
  })
  it('checks admin server-side', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@test')
    mocks.getUser.mockResolvedValue({ data: { user: { email: 'user@test' } }, error: null })
    expect((await middleware(new NextRequest('http://localhost/admin'))).headers.get('location')).toBe('http://localhost/dashboard')
    mocks.getUser.mockResolvedValue({ data: { user: { email: 'admin@test' } }, error: null })
    expect((await middleware(new NextRequest('http://localhost/admin'))).headers.get('location')).toBeNull()
  })
  it('does not bypass protected paths containing the webhook-secret pattern', async () => {
    expect((await middleware(new NextRequest('http://localhost/admin/api/bots/id/webhook-secret'))).headers.get('location')).toBe('http://localhost/auth')
  })
  it('limits sensitive API requests before auth', async () => {
    for (let n = 0; n < 60; n++) await rateLimiter.consume('auth:auth-ip', 60, 60000)
    const response = await middleware(new NextRequest('http://localhost/api/bots', { headers: { 'x-forwarded-for': 'auth-ip' } }))
    expect(response.status).toBe(429)
    expect(mocks.getUser).not.toHaveBeenCalled()
  })
  it('ignores public admin email settings', () => {
    vi.stubEnv('ADMIN_EMAILS', '')
    vi.stubEnv('NEXT_PUBLIC_ADMIN_EMAILS', 'public@test')
    expect(isAdminUser({ email: 'public@test' })).toBe(false)
  })
  it('requires a bot instead of using global credentials', async () => {
    vi.stubEnv('API_KEY', 'test-global')
    vi.stubEnv('API_SECRET', 'test-global')
    await expect(getExchangeCredentials(webhook(), 'bitget')).rejects.toThrow('Bot ID is required')
  })
})
