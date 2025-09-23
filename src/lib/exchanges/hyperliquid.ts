import * as ccxt from 'ccxt'
import type { ExchangePlugin, ResolvedExchangeCredentials } from './types'

export const hyperliquidPlugin: ExchangePlugin = {
  id: 'hyperliquid',
  label: 'Hyperliquid',
  requiredCredentials: ['apiKey'],
  optionalCredentials: ['apiSecret'],
  createClient: async (credentials?: ResolvedExchangeCredentials) => {
    const options: Record<string, unknown> = {
      enableRateLimit: true,
    }

    if (credentials?.apiKey) {
      options.apiKey = credentials.apiKey
      options.walletAddress = credentials.apiKey
    }

    if (credentials?.apiSecret) {
      options.secret = credentials.apiSecret
      options.privateKey = credentials.apiSecret
    }

    return new ccxt.hyperliquid(options)
  },
  formatSymbol: (_exchange, symbol) => symbol,
  getBalanceParams: (credentials) => ({ user: credentials.apiKey }),
}
