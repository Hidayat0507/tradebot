import type { TradingViewSignal } from '@/types';
import { ApiError } from '../api-handler';
import { createExchangeClient, validateMarket } from '../exchange-middleware';
import { logger, normalizeError } from '@/lib/logging';
import { marketCache } from '@/lib/market-cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/schema';
import type { TickerResult } from '@/types/exchange';
import { BotData } from './execute-trade';
import { executeTrade } from './execute-trade';
import { saveTrade } from './save-trade';

/**
 * Process webhook alert
 */
export async function processWebhookAlert(
  alert: TradingViewSignal,
  bot: BotData,
  supabase: SupabaseClient<Database>
) {
  try {
    // Create exchange client with proper credentials
    const exchange_client = await createExchangeClient(bot.exchange, {
      apiKey: bot.api_key,
      apiSecret: bot.api_secret,
      password: bot.password
    });

    // Validate market and get current price
    const isValidMarket = await validateMarket(exchange_client, alert.symbol);
    if (!isValidMarket) {
      throw new ApiError(`Invalid market: ${alert.symbol}`, 400);
    }
    
    // Try to get ticker from cache first
    let ticker: TickerResult;
    const cachedTicker = marketCache.get<TickerResult>(exchange_client.id, alert.symbol, 'ticker');
    
    if (cachedTicker) {
      logger.info('Using cached ticker for trade price', { 
        exchange: exchange_client.id, 
        symbol: alert.symbol
      });
      ticker = cachedTicker;
    } else {
      // Fetch fresh ticker data
      logger.info('Fetching fresh ticker for trade price', { 
        exchange: exchange_client.id, 
        symbol: alert.symbol
      });
      ticker = await exchange_client.fetchTicker(alert.symbol);
      
      // Cache the ticker for future use
      marketCache.set(exchange_client.id, alert.symbol, 'ticker', ticker);
    }
    
    if (!ticker.last) {
      throw new ApiError('Could not determine trade price', 400);
    }

    // Use the price from the alert if provided, otherwise use market price
    const tradePrice = alert.price || ticker.last;
    logger.info('Using price for trade', { 
      price: tradePrice, 
      source: alert.price ? 'alert' : 'market',
      marketPrice: ticker.last
    });

    // Execute trade
    const { order, calculatedAmount } = await executeTrade(exchange_client, alert, tradePrice, bot);

    // Save trade to database
    const trade = await saveTrade(supabase, bot.user_id, bot.id, order, alert, tradePrice, calculatedAmount);

    logger.info('Trade executed successfully', {
      botId: alert.bot_id,
      symbol: alert.symbol,
      action: alert.action,
      price: tradePrice,
      amount: calculatedAmount
    });

    return trade;
  } catch (error) {
    logger.error('Failed to process webhook alert', normalizeError(error), { alert });
    throw error;
  }
}
