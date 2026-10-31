import { describe, it, expect } from 'vitest'
import * as ccxt from 'ccxt'
import { enableTestnet, assertTestnetClient, TestnetGuardError } from '@/lib/exchanges/testnet'
import { modeOf } from '@/lib/bot-config'

describe('testnet guard', () => {
  it('hyperliquid sandbox points only at the testnet API', () => {
    const c = enableTestnet(new ccxt.hyperliquid({}))
    expect(JSON.stringify(c.urls.api)).toContain('api.hyperliquid-testnet.xyz')
    expect(JSON.stringify(c.urls.api)).not.toContain('api.hyperliquid.xyz')
  })
  it('rejects a mainnet hyperliquid client', () => {
    expect(() => assertTestnetClient(new ccxt.hyperliquid({}))).toThrow(TestnetGuardError)
  })
  it('bitget demo mode is enforced', () => {
    expect(() => assertTestnetClient(new ccxt.bitget({}))).toThrow(TestnetGuardError)
    expect(enableTestnet(new ccxt.bitget({})).options.sandboxMode).toBe(true)
  })
  it('rejects exchanges without a known testnet', () => {
    expect(() => assertTestnetClient({ id: 'kraken', urls: { api: 'https://api.kraken.com' } })).toThrow(TestnetGuardError)
  })
  it('modeOf understands testnet', () => {
    expect(modeOf({ mode: 'testnet' })).toBe('testnet')
    expect(modeOf({ mode: null })).toBe('live')
  })
})

describe('executeTrade testnet hard stop', () => {
  it('refuses to trade a testnet bot on a mainnet client', async () => {
    const { executeTrade } = await import('@/app/api/_middleware/webhook/execute-trade')
    const prev = process.env.TRADING_MODE; delete process.env.TRADING_MODE
    const mainnet = new ccxt.hyperliquid({}) as never
    await expect(executeTrade(mainnet, { bot_id: 'b', alert_id: 'a', symbol: 'ETH/USDC:USDC', action: 'buy', amount: 0.01 } as never, 3000,
      { id: 'b', exchange: 'hyperliquid', mode: 'testnet' } as never)).rejects.toThrow(/testnet/i)
    process.env.TRADING_MODE = prev
  })
})
