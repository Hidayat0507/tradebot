import type { TradingViewSignal } from '@/types';
import { ApiError } from '../api-handler';
import { createExchangeClient, validateMarket } from '../exchange-middleware';
import { logger } from '@/lib/logging';
import { marketCache } from '@/lib/market-cache';
import * as ccxt from 'ccxt';
import { BotData } from './execute-trade';
import { executeTrade } from './execute-trade';
import { saveTrade } from './save-trade';

/**
 * Process webhook alert
 */
export async function processWebhookAlert(
  alert: TradingViewSignal,
  bot: BotData,
  supabase: any
) {
  try {
    // Create exchange client with proper credentials
    const exchange_client = await createExchangeClient(bot.exchange, {
      apiKey: bot.api_key,
      apiSecret: bot.api_secret
    });

    // Validate market and get current price
    const isValidMarket = await validateMarket(exchange_client, alert.symbol);
    if (!isValidMarket) {
      throw new ApiError(`Invalid market: ${alert.symbol}`, 400);
    }
    
    // Try to get ticker from cache first
    let ticker: ccxt.Ticker;
    const cachedTicker = marketCache.get<ccxt.Ticker>(exchange_client.id, alert.symbol, 'ticker');
    
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
    const { order, calculatedAmount } = await executeTrade(exchange_client, alert, isValidMarket, tradePrice, bot);

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
    logger.error('Failed to process webhook alert', { error, alert });
    throw error;
  }
} 