import { NextRequest } from 'next/server'
import { 
  getAuthenticatedUser,
  handleApiError,
  successResponse,
  ApiError
} from '@/app/api/_middleware/api-handler'
import { 
  createExchangeClient,
  ExchangeCredentials
} from '@/app/api/_middleware/exchange-middleware'
import { logger } from '@/lib/logging'

function normalizeSymbol(symbol: string | null | undefined): string | undefined {
  if (!symbol) return undefined
  if (symbol.includes('/')) return symbol
  // Basic normalization for common cases like BTCUSDT -> BTC/USDT
  if (symbol.endsWith('USDT')) {
    return symbol.replace(/USDT$/i, '/USDT')
  }
  if (symbol.endsWith('USDC')) {
    return symbol.replace(/USDC$/i, '/USDC')
  }
  return symbol
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const search = request.nextUrl.searchParams
    const botId = search.get('botId')
    const side = (search.get('side') || 'buy').toLowerCase()
    const rawSymbol = search.get('symbol') || undefined
    const symbol = normalizeSymbol(rawSymbol)

    if (!botId) {
      throw new ApiError('botId is required', 400)
    }

    // Load bot and ensure it belongs to user and is Bitget
    const { data: bot, error } = await supabase
      .from('bots')
      .select('id, name, exchange, pair, api_key, api_secret, password')
      .eq('id', botId)
      .eq('user_id', user.id)
      .single()

    if (error || !bot) {
      throw new ApiError('Bot not found', 404)
    }

    if (bot.exchange.toLowerCase() !== 'bitget') {
      throw new ApiError('This health-check is only for Bitget bots', 400)
    }

    // Build exchange client with credentials (decryption handled in middleware)
    const credentials: ExchangeCredentials = {
      apiKey: bot.api_key,
      apiSecret: bot.api_secret,
      password: (bot as any).password || undefined
    }

    const exchange = await createExchangeClient('bitget', credentials, 'bitget_health_check')

    // Try to enable sandbox mode if supported (do not fail if not)
    try {
      if (typeof (exchange as any).setSandboxMode === 'function') {
        await (exchange as any).setSandboxMode(true)
      }
    } catch (e) {
      logger.warn('Bitget sandbox mode not available', { error: e instanceof Error ? e.message : String(e) })
    }

    // Checks
    const checks: Record<string, unknown> = {}

    // Balance check
    try {
      const balance = await exchange.fetchBalance()
      checks.balance_ok = true
      checks.currencies = Object.keys(balance.total || {})
    } catch (e) {
      checks.balance_ok = false
      checks.balance_error = e instanceof Error ? e.message : String(e)
    }

    // Markets and symbol check
    try {
      const markets = await exchange.fetchMarkets()
      checks.markets_ok = true
      const testSymbol = symbol || normalizeSymbol(bot.pair) || 'BTC/USDT'
      checks.test_symbol = testSymbol
      const match = markets.find(m => m && m.symbol === testSymbol)
      checks.symbol_supported = !!match
      if (match) {
        checks.symbol_limits = match.limits
        checks.symbol_precision = match.precision
      }
    } catch (e) {
      checks.markets_ok = false
      checks.markets_error = e instanceof Error ? e.message : String(e)
    }

    // Capability check (no order placement)
    try {
      checks.can_create_order = !!exchange.has?.createOrder
      checks.order_types = exchange.has || {}
      checks.side = side
    } catch (e) {
      checks.can_create_order = false
    }

    return successResponse({
      ok: true,
      exchange: exchange.id,
      bot: { id: bot.id, name: bot.name },
      checks
    })
  } catch (error) {
    return handleApiError(error)
  }
}



