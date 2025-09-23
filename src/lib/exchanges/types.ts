import type * as ccxt from 'ccxt'
import type { SupportedExchange } from '@/lib/database/schema'

export type ExchangeCredentialKey = 'apiKey' | 'apiSecret' | 'password'

export interface StoredExchangeCredentials {
  apiKey: string
  apiSecret?: string | null
  password?: string | null
}

export interface ResolvedExchangeCredentials {
  apiKey: string
  apiSecret?: string
  password?: string
}

export interface BalanceResult {
  total?: Record<string, number>
  free?: Record<string, number>
  used?: Record<string, number>
}

export interface ExchangePlugin {
  id: SupportedExchange
  label: string
  requiredCredentials: ExchangeCredentialKey[]
  optionalCredentials?: ExchangeCredentialKey[]
  createClient: (
    credentials?: ResolvedExchangeCredentials,
    context?: string
  ) => Promise<ccxt.Exchange>
  formatSymbol?: (exchange: ccxt.Exchange, symbol: string) => string
  getBalanceParams?: (
    credentials: ResolvedExchangeCredentials,
    options?: { context?: string }
  ) => Record<string, unknown> | undefined
}
