import { NextRequest } from 'next/server'
import { ApiError } from '@/app/api/_middleware/api-handler'
import { 
  getAuthenticatedUser,
  handleApiError,
  successResponse,
  validateFields
} from '@/app/api/_middleware/api-handler'
import { 
  createExchangeClient,
  fetchMarketData
} from '@/app/api/_middleware/exchange-middleware'
import { logger, normalizeError } from '@/lib/logging'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    
    // Get user's bots with their exchange and pair
    const { data: bots, error } = await supabase
      .from('bots')
      .select('id, exchange, pair')
      .eq('user_id', user.id)

    if (error) {
      const err = normalizeError(error)
      logger.error('Failed to fetch bots', err, { userId: user.id })
      throw new ApiError('Failed to fetch bots', 500)
    }

    if (!bots || bots.length === 0) {
      return successResponse([])
    }

    // Fetch market data for each bot (only Bitget; Hyperliquid public market data disabled here)
    const marketDataPromises = bots
      .filter(bot => ['bitget'].includes(bot.exchange.toLowerCase()))
      .map(async (bot) => {
        try {
          const exchange_client = await createExchangeClient(bot.exchange, undefined, 'market_data')
          const marketData = await fetchMarketData(exchange_client, bot.pair)
          
          return {
            bot_id: bot.id,
            ...marketData
          }
        } catch (error) {
          const err = normalizeError(error)
          logger.error('Failed to fetch market data for bot', err, {
            botId: bot.id,
            exchange: bot.exchange,
            pair: bot.pair,
          })
          
          // Return error info instead of failing the entire request
          return {
            bot_id: bot.id,
            exchange: bot.exchange,
            symbol: bot.pair,
            error: true,
            message: err.message
          }
        }
      })

    const marketData = await Promise.all(marketDataPromises)
    return successResponse(marketData)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    
    // Validate required fields
    validateFields(payload, ['exchange', 'symbol'])
    
    const { exchange, symbol } = payload
    
    // Only allow Bitget exchange for public market data
    if (!['bitget'].includes(exchange.toLowerCase())) {
      logger.info('Rejecting non-Bitget market data request', { exchange, symbol })
      return successResponse({
        error: true,
        message: "Only Bitget exchange is supported for market data requests.",
        symbol,
        exchange
      })
    }
    
    logger.info('Market data request', { exchange, symbol })
    
    // Create exchange client for public data (no credentials needed)
    const exchange_client = await createExchangeClient('bitget', undefined, 'market_data')
    
    try {
      const marketData = await fetchMarketData(exchange_client, symbol)
      return successResponse(marketData)
    } catch (error) {
      // If it's a BadSymbol error, return a 200 response with error info
      // This allows the frontend to handle unsupported symbols gracefully
      if (error instanceof ApiError && error.message.includes('not supported')) {
        logger.warn('Unsupported symbol requested', { exchange, symbol, error: error.message })
        return successResponse({
          error: true,
          message: error.message,
          symbol,
          exchange
        })
      }
      
      // Re-throw other errors to be handled by general error handler
      throw error
    }
  } catch (error) {
    return handleApiError(error)
  }
}
