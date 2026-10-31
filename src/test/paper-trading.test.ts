import { afterEach, describe, expect, it, vi } from 'vitest'
import { executeTrade, type BotData } from '@/app/api/_middleware/webhook/execute-trade'
import type { ExchangeClient } from '@/types/exchange'

const bot: BotData = {
  id: 'offline', name: 'Paper', exchange: 'bitget', user_id: 'offline',
  api_key: '', api_secret: '', webhook_secret: '',
}
const alert = { bot_id: bot.id, symbol: 'BTC/USDT', action: 'buy' as const, amount: 2 }

afterEach(() => vi.unstubAllEnvs())

describe('required offline paper trading guard', () => {
  it.each(['bitget', 'hyperliquid'])('simulates a %s fill without exchange calls', async (id) => {
    const createOrder = vi.fn()
    const fetchBalance = vi.fn()
    const exchange = { id, createOrder, fetchBalance } as unknown as ExchangeClient
    const result = await executeTrade(exchange, alert, 100, { ...bot, exchange: id })
    expect(result.calculatedAmount).toBe(2)
    expect(result.order).toMatchObject({ filled: 2, remaining: 0, price: 100, cost: 200, status: 'closed' })
    expect(createOrder).not.toHaveBeenCalled()
    expect(fetchBalance).not.toHaveBeenCalled()
    expect(exchange.options).toBeUndefined()
  })

  it('respects bot paper mode when the environment selects live', async () => {
    vi.stubEnv('TRADING_MODE', 'live')
    const result = await executeTrade({} as ExchangeClient, alert, 100, { ...bot, mode: 'paper' })
    expect(result.order.id).toMatch(/^paper-/)
  })

  it.each([undefined, 0, -1, NaN, Infinity])('rejects invalid paper amounts (%s) without querying balances', async (amount) => {
    await expect(executeTrade({} as ExchangeClient, { ...alert, amount }, 100, bot))
      .rejects.toThrow('Paper trading requires a positive finite amount and price')
  })

  it.each([0, -1, NaN, Infinity])('rejects invalid paper prices (%s) before any exchange call', async (price) => {
    await expect(executeTrade({} as ExchangeClient, alert, price, bot))
      .rejects.toThrow('Paper trading requires a positive finite amount and price')
  })
})
