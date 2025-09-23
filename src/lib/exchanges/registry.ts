import type { SupportedExchange } from '@/lib/database/schema'
import { bitgetPlugin } from './bitget'
import { hyperliquidPlugin } from './hyperliquid'
import type { ExchangePlugin } from './types'

const plugins: Record<SupportedExchange, ExchangePlugin> = {
  bitget: bitgetPlugin,
  hyperliquid: hyperliquidPlugin,
}

const disabled = new Set(
  (process.env.DISABLED_EXCHANGES || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
)

export class ExchangeNotFoundError extends Error {}
export class ExchangeDisabledError extends Error {}

export function normalizeExchangeId(exchange: string | SupportedExchange): SupportedExchange {
  const normalized = exchange.toString().toLowerCase() as SupportedExchange
  if (!plugins[normalized]) {
    throw new ExchangeNotFoundError(`Unsupported exchange: ${exchange}`)
  }
  return normalized
}

export function getExchangePlugin(exchange: string | SupportedExchange): ExchangePlugin {
  const normalized = normalizeExchangeId(exchange)
  if (disabled.has(normalized)) {
    throw new ExchangeDisabledError(`Exchange ${normalized} is disabled`) 
  }
  return plugins[normalized]
}

export function listEnabledExchanges(): ExchangePlugin[] {
  return Object.values(plugins).filter((plugin) => !disabled.has(plugin.id))
}
