import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database/schema'
const mocks = vi.hoisted(() => ({ client: vi.fn(), createOrder: vi.fn() }))
vi.mock('ccxt', () => ({ default: { bitget: vi.fn(() => ({ createOrder: mocks.createOrder })) } }))
vi.mock('@/app/api/_middleware/exchange-middleware', () => ({ createExchangeClient: mocks.client, validateMarket: vi.fn() }))
vi.mock('@/lib/logging', () => ({ logger: { error: vi.fn(), info: vi.fn() }, normalizeError: (e: unknown) => e }))
import { processWebhookAlert } from '@/app/api/_middleware/webhook/process-webhook'

const bot = { id: 'bot', user_id: 'user', name: 'Paper', exchange: 'bitget', api_key: '', api_secret: '', webhook_secret: '' }
const alert = { bot_id: 'bot', symbol: 'BTC/USDT', action: 'buy' as const, amount: 0.01, price: 50000 }
describe('paper trading', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('TRADING_MODE', 'paper') })
  afterEach(() => vi.unstubAllEnvs())
  it.each(['env', 'bot'])('simulates a fill without an exchange client (%s)', async (mode) => {
    vi.stubEnv('TRADING_MODE', mode === 'env' ? 'paper' : 'live')
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 'trade' }, error: null }) }) })
    const supabase = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient<Database>
    await processWebhookAlert(alert, { ...bot, ...(mode === 'bot' ? { mode: 'paper' as const } : {}) }, supabase)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'filled', price: 50000, size: 0.01, external_id: expect.stringMatching(/^paper-/) }))
    expect(mocks.client).not.toHaveBeenCalled()
    expect(mocks.createOrder).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })
  it('rejects paper trades without a price instead of fetching one', async () => {
    await expect(processWebhookAlert({ ...alert, price: undefined }, bot, {} as SupabaseClient<Database>)).rejects.toThrow('Paper trades require')
    expect(mocks.client).not.toHaveBeenCalled()
  })
})
