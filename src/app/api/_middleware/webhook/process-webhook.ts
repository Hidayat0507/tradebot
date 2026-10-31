import type { TradingViewSignal } from '@/types';
import { ApiError } from '../api-handler';
import { createExchangeClient, validateMarket } from '../exchange-middleware';
import { logger, normalizeError } from '@/lib/logging';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/schema';
import { BotData } from './execute-trade';
import { executeTrade, validateOrderSafety, isPaperMode } from './execute-trade';
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
    validateOrderSafety(alert, bot);
    // Create exchange client with proper credentials
    const exchange_client = await createExchangeClient(bot.exchange, isPaperMode(bot) ? undefined : {
      apiKey: bot.api_key,
      apiSecret: bot.api_secret,
      password: bot.password
    });

    // Validate market and get current price
    const isValidMarket = await validateMarket(exchange_client, alert.symbol);
    if (!isValidMarket) {
      throw new ApiError(`Invalid market: ${alert.symbol}`, 400);
    }
    
    // Safety decisions require a fresh ticker, not a cached or alert supplied price.
    const ticker = await exchange_client.fetchTicker(bot.pair);
    const tradePrice = ticker.last;
    if (tradePrice === undefined || !Number.isFinite(tradePrice) || tradePrice <= 0) {
      throw new ApiError('Could not determine trade price', 400);
    }

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
