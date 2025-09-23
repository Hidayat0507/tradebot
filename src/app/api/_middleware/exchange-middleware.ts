import * as ccxt from 'ccxt'
import { ApiError } from './api-handler'
import { decrypt } from '@/utils/encryption'
import { logger, normalizeError } from '@/lib/logging'
import { marketCache } from '@/lib/market-cache'
import {
  ExchangeDisabledError,
  ExchangeNotFoundError,
  getExchangePlugin,
  normalizeExchangeId,
} from '@/lib/exchanges/registry'
import type {
  ExchangePlugin,
  ResolvedExchangeCredentials,
  StoredExchangeCredentials,
} from '@/lib/exchanges/types'
import type { SupportedExchange } from '@/lib/database/schema'
import type { ExchangeClient, TickerResult, OrderBookResult, BalanceMap } from '@/types/exchange'

export interface ExchangeCredentials extends StoredExchangeCredentials {
  apiKey: string
}

function mapExchangeError(error: unknown, exchange: string): never {
  if (error instanceof ExchangeDisabledError) {
    throw new ApiError(`Exchange ${exchange} is disabled`, 503)
  }
  if (error instanceof ExchangeNotFoundError) {
    throw new ApiError(`Unsupported exchange: ${exchange}`, 400)
  }
  if (error instanceof ApiError) {
    throw error
  }

  const err = normalizeError(error)
  logger.error('Exchange error', err, { exchange })
  throw new ApiError('Failed to process exchange request', 500)
}

async function decryptWithFallback(
  exchange: string,
  field: 'apiSecret' | 'password',
  value: string
): Promise<string> {
  try {
    logger.info(`Attempting to decrypt ${field}`, {
      exchange,
      length: value.length,
      format: value.includes(':') ? 'encrypted' : 'plaintext',
    })
    const decrypted = await decrypt(value)
    logger.info(`Successfully decrypted ${field}`, {
      exchange,
      length: decrypted.length,
    })
    return decrypted
  } catch (error) {
    const err = normalizeError(error)
    logger.error(`Failed to decrypt ${field}`, err, { exchange })
    logger.info(`Using provided ${field} value as fallback`, { exchange })
    return value
  }
}

export async function resolveExchangeCredentials(
  exchange: string,
  credentials?: ExchangeCredentials
): Promise<ResolvedExchangeCredentials | undefined> {
  if (!credentials) return undefined

  const normalized = normalizeExchangeId(exchange)
  const result: ResolvedExchangeCredentials = {
    apiKey: credentials.apiKey,
  }

  if (credentials.apiSecret) {
    result.apiSecret = await decryptWithFallback(normalized, 'apiSecret', credentials.apiSecret)
  }

  if (credentials.password) {
    result.password = await decryptWithFallback(normalized, 'password', credentials.password)
  }

  return result
}

async function createClientInternal(
  exchange: string,
  plugin: ExchangePlugin,
  credentials?: ResolvedExchangeCredentials,
  context?: string
): Promise<ExchangeClient> {
  try {
    logger.info('Creating exchange client', {
      exchange,
      context,
      hasCredentials: !!credentials,
      hasSecret: !!credentials?.apiSecret,
      hasPassword: !!credentials?.password,
    })

    const client = await plugin.createClient(credentials, context)
    logger.info('Exchange client created successfully', { exchange, context })
    return client as unknown as ExchangeClient
  } catch (error) {
    const err = normalizeError(error)
    logger.error('Failed to create exchange client', err, {
      exchange,
      context,
    })

    if (error instanceof ccxt.AuthenticationError) {
      throw new ApiError('Invalid API credentials', 401)
    }
    if (error instanceof ccxt.PermissionDenied) {
      throw new ApiError('API key does not have required permissions', 403)
    }
    if (error instanceof ccxt.RateLimitExceeded) {
      throw new ApiError('Rate limit exceeded - please try again later', 429)
    }
    if (error instanceof ccxt.NetworkError) {
      throw new ApiError('Network error - please check your connection', 503)
    }

    throw new ApiError('Failed to initialize exchange client', 500)
  }
}

export async function createExchangeClient(
  exchange: string,
  credentials?: ExchangeCredentials,
  context?: string
): Promise<ExchangeClient> {
  try {
    const plugin = getExchangePlugin(exchange)
    const resolvedCredentials = await resolveExchangeCredentials(exchange, credentials)
    return await createClientInternal(plugin.id, plugin, resolvedCredentials, context)
  } catch (error) {
    mapExchangeError(error, exchange)
  }
}

function getPluginForExchange(exchange: string | SupportedExchange): ExchangePlugin {
  try {
    return getExchangePlugin(exchange)
  } catch (error) {
    mapExchangeError(error, exchange.toString())
  }
}

function formatSymbol(plugin: ExchangePlugin, exchange: ExchangeClient, symbol: string): string {
  try {
    if (typeof plugin.formatSymbol === 'function') {
      // Cast only for the plugin call site, ExchangeClient is our narrowed interface
      return plugin.formatSymbol(exchange as unknown as ccxt.Exchange, symbol)
    }
    return symbol
  } catch (error) {
    logger.warn(
      'Error formatting symbol',
      {
        exchange: exchange.id,
        symbol,
      },
      normalizeError(error)
    )
    return symbol
  }
}

export const fetchMarketData = async (exchange_client: ExchangeClient, symbol: string) => {
  const plugin = getPluginForExchange(exchange_client.id as SupportedExchange)

  try {
    const formattedSymbol = formatSymbol(plugin, exchange_client, symbol)

    const result: Record<string, unknown> = {
      symbol,
      formatted_symbol: formattedSymbol,
    }

    const cachedTicker = marketCache.get<TickerResult>(exchange_client.id, symbol, 'ticker')
    if (cachedTicker) {
      logger.info('Using cached ticker data', {
        exchange: exchange_client.id,
        symbol,
      })
      result.last_price = cachedTicker.last
      result.bid = cachedTicker.bid
      result.ask = cachedTicker.ask
      result.volume_24h = cachedTicker.baseVolume || cachedTicker.quoteVolume
      result.change_24h = cachedTicker.percentage
      result.high_24h = cachedTicker.high
      result.low_24h = cachedTicker.low
    } else {
      logger.info('Fetching ticker data', {
        exchange: exchange_client.id,
        symbol,
      })
      const ticker = await exchange_client.fetchTicker(formattedSymbol)
      marketCache.set(exchange_client.id, symbol, 'ticker', ticker)
      result.last_price = ticker.last
      result.bid = ticker.bid
      result.ask = ticker.ask
      result.volume_24h = ticker.baseVolume || ticker.quoteVolume
      result.change_24h = ticker.percentage
      result.high_24h = ticker.high
      result.low_24h = ticker.low
    }

    const cachedOrderBook = marketCache.get<OrderBookResult>(exchange_client.id, symbol, 'orderBook')
    if (cachedOrderBook) {
      logger.info('Using cached order book data', {
        exchange: exchange_client.id,
        symbol,
      })
      result.order_book = {
        bids: cachedOrderBook.bids.slice(0, 5).map(([price, amount]) => ({ price, amount })),
        asks: cachedOrderBook.asks.slice(0, 5).map(([price, amount]) => ({ price, amount })),
      }
    } else {
      logger.info('Fetching order book data', {
        exchange: exchange_client.id,
        symbol,
      })
      const orderBook = await exchange_client.fetchOrderBook(formattedSymbol)
      marketCache.set(exchange_client.id, symbol, 'orderBook', orderBook)
      result.order_book = {
        bids: orderBook.bids.slice(0, 5).map(([price, amount]) => ({ price, amount })),
        asks: orderBook.asks.slice(0, 5).map(([price, amount]) => ({ price, amount })),
      }
    }

    const cachedOHLCV = marketCache.get<number[][]>(exchange_client.id, symbol, 'ohlcv')
    if (cachedOHLCV) {
      logger.info('Using cached OHLCV data', {
        exchange: exchange_client.id,
        symbol,
      })
      result.ohlcv =
        cachedOHLCV.length > 0
          ? {
              timestamp: cachedOHLCV[0][0],
              open: cachedOHLCV[0][1],
              high: cachedOHLCV[0][2],
              low: cachedOHLCV[0][3],
              close: cachedOHLCV[0][4],
              volume: cachedOHLCV[0][5],
            }
          : null
    } else {
      logger.info('Fetching OHLCV data', {
        exchange: exchange_client.id,
        symbol,
      })
      const ohlcv = await exchange_client.fetchOHLCV(formattedSymbol, '1d', undefined, 1)
      marketCache.set(exchange_client.id, symbol, 'ohlcv', ohlcv)
      result.ohlcv =
        ohlcv.length > 0
          ? {
              timestamp: ohlcv[0][0],
              open: ohlcv[0][1],
              high: ohlcv[0][2],
              low: ohlcv[0][3],
              close: ohlcv[0][4],
              volume: ohlcv[0][5],
            }
          : null
    }

    return result
  } catch (error) {
    const err = normalizeError(error)
    logger.error('Error fetching market data', err, {
      exchange: exchange_client.id,
      symbol,
    })

    if (error instanceof ccxt.ExchangeError) {
      if (error.message.includes('BadSymbol')) {
        throw new ApiError(
          `Symbol ${symbol} not supported on ${exchange_client.id}. Please check the symbol format.`,
          400
        )
      }
      throw new ApiError(`Exchange error: ${error.message}`, 400)
    }

    throw error
  }
}

export async function validateMarket(exchange: ExchangeClient, symbol: string): Promise<boolean> {
  try {
    const cachedMarkets = marketCache.get<ccxt.Market[]>(exchange.id, 'all', 'markets')
    if (cachedMarkets) {
      logger.info('Using cached markets for validation', {
        exchange: exchange.id,
        symbol,
        marketsCount: cachedMarkets.length,
      })
      const market = cachedMarkets.find((m) => m && m.symbol === symbol)
      return !!market
    }

    logger.info('Fetching markets for validation', { exchange: exchange.id, symbol })
    const markets = await exchange.fetchMarkets()
    marketCache.set(exchange.id, 'all', 'markets', markets)
    const market = markets.find((m) => m && m.symbol === symbol)
    return !!market
  } catch (error) {
    const err = normalizeError(error)
    logger.error('Failed to validate market', err, {
      exchange: exchange.id,
      symbol,
    })
    return false
  }
}

export async function fetchBalance(
  exchange: ExchangeClient,
  exchangeId: string,
  credentials: ResolvedExchangeCredentials
) {
  const plugin = getPluginForExchange(exchangeId as SupportedExchange)

  try {
    logger.info('Fetching balance', {
      exchange: exchange.id,
      exchangeId,
      hasApiKey: !!credentials.apiKey,
      hasSecret: !!credentials.apiSecret,
    })

    const params = plugin.getBalanceParams?.(credentials)
    const balance = await exchange.fetchBalance(params) as BalanceMap

    logger.info('Balance fetched successfully', {
      exchange: exchange.id,
      currencies: Object.keys(balance.total || {}).length,
    })

    return {
      total: balance.total,
      free: balance.free,
      used: balance.used,
    }
  } catch (error) {
    const err = normalizeError(error)
    logger.error('Failed to fetch balance', err, {
      exchange: exchange.id,
      errorType: err.name,
    })

    if (error instanceof ccxt.AuthenticationError) {
      throw new ApiError('Authentication failed: Invalid API credentials', 401)
    }
    if (error instanceof ccxt.PermissionDenied) {
      throw new ApiError(
        'Permission denied: Your API key may not have permission to fetch balance',
        403
      )
    }
    if (error instanceof ccxt.ExchangeError) {
      throw new ApiError(`Exchange error: ${error.message}`, 400)
    }

    throw new ApiError('Failed to fetch balance from exchange', 500)
  }
}
