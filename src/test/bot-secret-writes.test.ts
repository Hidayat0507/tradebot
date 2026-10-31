import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  cookie: { from: vi.fn(), auth: { getUser: vi.fn() } },
  service: { from: vi.fn() },
  createService: vi.fn(),
  loadMarkets: vi.fn(), fetchBalance: vi.fn(),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => mocks.cookie),
  createServiceClient: mocks.createService,
}))
vi.mock('ccxt', () => ({ default: { bitget: vi.fn(), hyperliquid: vi.fn() } }))
vi.mock('@/lib/exchanges/registry', () => ({
  listEnabledExchanges: () => [{ id: 'bitget' }],
  getExchangePlugin: () => ({ requiredCredentials: ['apiKey', 'apiSecret'],
    createClient: async () => ({ loadMarkets: mocks.loadMarkets, fetchBalance: mocks.fetchBalance }) }),
}))
vi.mock('@/utils/encryption', () => ({ encrypt: async (value: string) => `encrypted:${value}` }))
vi.mock('@/lib/subscriptions', () => ({ resolveBotLimit: async () => ({ limit: null }) }))
vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn(), error: vi.fn() },
  normalizeError: (error: unknown) => error instanceof Error ? error : new Error('mock error') }))

import { POST as createBot } from '@/app/api/bots/route'
import { PUT } from '@/app/api/bots/[id]/route'
import { POST as rotate } from '@/app/api/bots/[id]/webhook-secret/route'
import { validateAndStoreCredentials } from '@/app/api/_middleware/exchange'

function query(result: unknown) {
  const builder = { select: vi.fn(), eq: vi.fn(), single: vi.fn(), insert: vi.fn(), update: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }
  for (const method of ['select', 'eq', 'insert', 'update'] as const) builder[method].mockReturnValue(builder)
  builder.single.mockResolvedValue(result)
  return builder
}
let ownerQuery: ReturnType<typeof query>
let writeQuery: ReturnType<typeof query>
const props = { params: Promise.resolve({ id: 'bot-id' }) }
const request = (body = {}) => new NextRequest('http://localhost/api/bots', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.cookie.auth.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
  ownerQuery = query({ data: { id: 'bot-id', user_id: 'owner' }, error: null })
  writeQuery = query({ data: { id: 'bot-id' }, error: null })
  mocks.cookie.from.mockReturnValue(ownerQuery)
  mocks.service.from.mockReturnValue(writeQuery)
  mocks.createService.mockReturnValue(mocks.service)
})

describe('service-only bot credential writes', () => {
  it('creates with the authenticated owner and encrypted credentials via service client', async () => {
    const response = await createBot(request({ name: 'bot', exchange: 'bitget', pair: 'BTC/USDT',
      user_id: 'attacker', api_key: 'dummy-key', api_secret: 'dummy-secret', password: 'dummy-password' }))
    expect(response.status).toBe(201)
    expect(writeQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'owner',
      api_secret: 'encrypted:dummy-secret', password: 'encrypted:dummy-password',
      webhook_secret: expect.stringMatching(/^sha256:/) }))
    expect((await response.json()).data.webhook_secret).toMatch(/^[a-f0-9]{64}$/)
    expect(ownerQuery.insert).not.toHaveBeenCalled()
  })
  it('updates only allowed fields with both owner and bot filters', async () => {
    expect((await PUT(request({ api_secret: 'dummy', user_id: 'attacker', id: 'other', webhook_secret: 'bad' }), props)).status).toBe(200)
    const payload = writeQuery.update.mock.calls[0][0]
    expect(payload.api_secret).toBe('encrypted:dummy')
    for (const field of ['user_id', 'id', 'webhook_secret']) expect(payload).not.toHaveProperty(field)
    expect(writeQuery.eq.mock.calls).toEqual([['id', 'bot-id'], ['user_id', 'owner']])
  })
  it('rotates secrets through the service client after ownership verification', async () => {
    expect((await rotate(request(), props)).status).toBe(200)
    expect(writeQuery.update).toHaveBeenCalledWith(expect.objectContaining({ webhook_secret: expect.stringMatching(/^sha256:/) }))
    expect(writeQuery.eq).toHaveBeenCalledWith('user_id', 'owner')
  })
  it('stores validated credentials through the service client', async () => {
    await validateAndStoreCredentials(request(), 'bot-id', 'dummy-key', 'dummy-secret', 'bitget', 'dummy-password')
    expect(writeQuery.update).toHaveBeenCalledWith(expect.objectContaining({ api_key: 'dummy-key', api_secret: 'encrypted:dummy-secret', password: 'encrypted:dummy-password' }))
    expect(writeQuery.eq).toHaveBeenCalledWith('user_id', 'owner')
  })
  it.each(['update', 'rotate', 'validate'])('denies non-owned bot %s before service or exchange access', async action => {
    ownerQuery.single.mockResolvedValue({ data: null, error: { message: 'not found' } })
    if (action === 'update') expect((await PUT(request(), props)).status).toBe(404)
    if (action === 'rotate') expect((await rotate(request(), props)).status).toBe(404)
    if (action === 'validate') await expect(validateAndStoreCredentials(request(), 'bot-id', 'dummy', 'dummy', 'bitget')).rejects.toMatchObject({ message: 'Bot not found', statusCode: 404 })
    expect(mocks.createService).not.toHaveBeenCalled()
    expect(mocks.loadMarkets).not.toHaveBeenCalled()
  })
  it('denies unauthenticated creation before service access', async () => {
    mocks.cookie.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await createBot(request())).status).toBe(401)
    expect(mocks.createService).not.toHaveBeenCalled()
  })
})
