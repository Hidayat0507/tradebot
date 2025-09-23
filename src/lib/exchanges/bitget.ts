import * as ccxt from 'ccxt'
import type { ExchangePlugin, ResolvedExchangeCredentials } from './types'

export const bitgetPlugin: ExchangePlugin = {
  id: 'bitget',
  label: 'Bitget',
  requiredCredentials: ['apiKey', 'apiSecret', 'password'],
  createClient: async (credentials?: ResolvedExchangeCredentials) => {
    const options: Record<string, unknown> = {
      enableRateLimit: true,
    }

    if (credentials?.apiKey) {
      options.apiKey = credentials.apiKey
    }
    if (credentials?.apiSecret) {
      options.secret = credentials.apiSecret
    }
    if (credentials?.password) {
      options.password = credentials.password
    }

    return new ccxt.bitget(options)
  },
}
