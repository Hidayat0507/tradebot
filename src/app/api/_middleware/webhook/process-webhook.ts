import { enableTestnet } from '@/lib/exchanges/testnet';
import type { TradingViewSignal } from '@/types';
import { ApiError } from '../api-handler';
import { createExchangeClient, validateMarket } from '../exchange-middleware';
import { logger, normalizeError } from '@/lib/logging';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/schema';
import { BotData } from './execute-trade';
import { executeTrade, validateOrderSafety, isPaperMode, isTestnetMode } from './execute-trade';
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
    if (isPaperMode(bot)) {
      // No client construction, market lookup, balance fetch, or external price feed.
      const { order, calculatedAmount } = await executeTrade(
        {} as Parameters<typeof executeTrade>[0], alert, alert.price ?? 0, bot
      );
      return await saveTrade(supabase, bot.user_id, bot.id, order, alert, alert.price!, calculatedAmount);
    }

    validateOrderSafety(alert, bot);

    // Create exchange client with proper credentials
    const exchange_client = await createExchangeClient(bot.exchange, {
      apiKey: bot.api_key,
      apiSecret: bot.api_secret,
      password: bot.password
    });

    const testnet = isTestnetMode(bot);
    if (testnet) enableTestnet(exchange_client);

    // Validate market and get current price
    const isValidMarket = testnet
      ? (await exchange_client.fetchMarkets()).some(market => market.symbol === alert.symbol)
      : await validateMarket(exchange_client, alert.symbol);
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
