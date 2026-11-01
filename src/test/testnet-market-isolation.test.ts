import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(), validate: vi.fn(), sandbox: vi.fn(), markets: vi.fn(),
  ticker: vi.fn(), execute: vi.fn(), save: vi.fn(),
}))
vi.mock('@/app/api/_middleware/exchange-middleware', () => ({
  createExchangeClient: mocks.create, validateMarket: mocks.validate,
}))
vi.mock('@/lib/exchanges/testnet', () => ({ enableTestnet: mocks.sandbox }))
vi.mock('@/app/api/_middleware/webhook/execute-trade', () => ({
  isPaperMode: () => false, isTestnetMode: () => true,
  validateOrderSafety: vi.fn(), executeTrade: mocks.execute,
}))
vi.mock('@/app/api/_middleware/webhook/save-trade', () => ({ saveTrade: mocks.save }))
import { processWebhookAlert } from '@/app/api/_middleware/webhook/process-webhook'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockResolvedValue({ fetchMarkets: mocks.markets, fetchTicker: mocks.ticker })
  mocks.markets.mockResolvedValue([{ symbol: 'ETH/USDC:USDC' }])
  mocks.ticker.mockResolvedValue({ last: 3000 })
  mocks.execute.mockResolvedValue({ order: {}, calculatedAmount: 1 })
})

describe('testnet public market isolation', () => {
  it('enables sandbox before fetching fresh markets and ticker, bypassing shared mainnet caches', async () => {
    await processWebhookAlert(
      { symbol: 'ETH/USDC:USDC' } as never,
      { pair: 'ETH/USDC:USDC', mode: 'testnet' } as never, {} as never,
    )
    expect(mocks.validate).not.toHaveBeenCalled()
    expect(mocks.sandbox.mock.invocationCallOrder[0]).toBeLessThan(mocks.markets.mock.invocationCallOrder[0])
    expect(mocks.ticker).toHaveBeenCalledWith('ETH/USDC:USDC')
    expect(mocks.execute).toHaveBeenCalledTimes(1)
  })
  it('rejects a market absent from the sandbox before execution', async () => {
    mocks.markets.mockResolvedValue([])
    await expect(processWebhookAlert({ symbol: 'ETH/USDC:USDC' } as never,
      { pair: 'ETH/USDC:USDC', mode: 'testnet' } as never, {} as never)).rejects.toThrow('Invalid market')
    expect(mocks.ticker).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })
})
