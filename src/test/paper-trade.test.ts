import { describe, expect, it, vi } from 'vitest'

vi.mock('ccxt', () => ({ default: { bitget: vi.fn(), hyperliquid: vi.fn() } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => { throw new Error('Database calls forbidden') }) }))
vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  normalizeError: (error: unknown) => error instanceof Error ? error : new Error(String(error)),
}))

import { executeTrade, type BotData } from '@/app/api/_middleware/webhook/execute-trade'
import type { ExchangeClient } from '@/types/exchange'

const bot: BotData = {
  id: 'test', user_id: 'owner', name: 'paper', exchange: 'bitget',
  api_key: '', api_secret: '', webhook_secret: '',
}
const alert = { bot_id: 'test', symbol: 'BTC/USDT', action: 'buy' as const, amount: 2 }

describe('paper fills', () => {
  it.each(['bitget', 'hyperliquid'])('simulates %s fills without touching any exchange method', async exchangeId => {
    const exchange = new Proxy({} as ExchangeClient, { get: () => { throw new Error('Exchange access forbidden') } })
    const result = await executeTrade(exchange, alert, 100, { ...bot, exchange: exchangeId })
    expect(result.calculatedAmount).toBe(2)
    expect(result.order).toMatchObject({ status: 'closed', filled: 2, remaining: 0, price: 100 })
    expect(result.order.id).toMatch(/^paper-/)
  })
  it('honors bot paper mode even when the environment is live', async () => {
    vi.stubEnv('TRADING_MODE', 'live')
    try {
      const exchange = { createOrder: vi.fn(), fetchBalance: vi.fn() } as unknown as ExchangeClient
      await executeTrade(exchange, alert, 100, { ...bot, mode: 'paper' })
      expect(exchange.createOrder).not.toHaveBeenCalled()
      expect(exchange.fetchBalance).not.toHaveBeenCalled()
    } finally { vi.unstubAllEnvs() }
  })
  it('rejects missing amounts without fetching a live balance', async () => {
    await expect(executeTrade({} as ExchangeClient, { ...alert, amount: undefined }, 100, bot))
      .rejects.toThrow('Paper trading requires a positive amount and price')
  })
})
