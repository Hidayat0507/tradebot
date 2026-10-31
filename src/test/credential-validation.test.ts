import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ loadMarkets: vi.fn(), fetchBalance: vi.fn(), createOrder: vi.fn() }))
vi.mock('ccxt', () => ({
  bitget: vi.fn(() => mocks), hyperliquid: vi.fn(() => mocks),
}))
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/utils/encryption', () => ({ encrypt: vi.fn() }))
import { validateExchangeCredentials } from '@/app/api/_middleware/exchange'
beforeEach(() => { vi.clearAllMocks(); mocks.loadMarkets.mockResolvedValue({}); mocks.fetchBalance.mockResolvedValue({}) })
describe('read-only credential validation', () => {
  it.each(['bitget', 'hyperliquid'] as const)('checks %s markets and balance without orders', async (exchange) => {
    await validateExchangeCredentials(exchange, 'test-key', 'test-secret', 'test-password')
    expect(mocks.loadMarkets).toHaveBeenCalledOnce()
    expect(mocks.fetchBalance).toHaveBeenCalledWith(exchange === 'hyperliquid' ? { type: 'spot', user: 'test-key' } : undefined)
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })
  it('propagates rejected credentials', async () => {
    mocks.fetchBalance.mockRejectedValueOnce(new Error('invalid credentials'))
    await expect(validateExchangeCredentials('bitget', 'key', 'secret', 'password')).rejects.toThrow('invalid credentials')
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })
})
