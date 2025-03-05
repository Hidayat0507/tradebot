import type { TradingViewSignal } from '@/types';
import { ApiError, validateFields } from './api-handler';
import { ExchangeCredentials, createExchangeClient, validateMarket } from './exchange-middleware';
import { logger } from '@/lib/logging';
import { executeSimulatedTrade } from './simulation-service';
import { marketCache } from '@/lib/market-cache';
import * as ccxt from 'ccxt';

// Enable simulation mode for testing
const SIMULATION_MODE = process.env.SIMULATION_MODE === 'true';

interface TradingViewAlert {
  symbol: string;
  action: 'BUY' | 'SELL';
  price?: number;
  strategy?: string;
  stoplossPercent?: number;
  bot_id: string;
  secret?: string;
  amount?: number; // Optional direct amount for manual testing
  order_size?: number; // Optional percentage of available balance to use (25, 50, 75, or 100)
}

export interface BotData {
  id: string;
  exchange: string;
  api_key: string;
  api_secret: string;
  user_id: string;
  webhook_secret: string;
  order_size?: number; // Percentage of available balance to use (25, 50, 75, or 100)
  name: string;
}

/**
 * Validate webhook alert data
 */
export function validateWebhookAlert(data: unknown): TradingViewSignal {
  if (!data || typeof data !== 'object') {
    throw new ApiError('Alert must be an object', 400);
  }

  const alert = data as any;

  // Validate required fields and format
  validateFields(
    alert,
    ['bot_id', 'symbol', 'action', 'secret'],
    {
      action: (value) => 
        ['BUY', 'SELL'].includes(value) || 
        'Invalid action (must be BUY or SELL)',
      price: (value) => 
        typeof value === 'undefined' || 
        (typeof value === 'number' && value > 0) || 
        'Price must be a positive number',
      stoplossPercent: (value) => 
        typeof value === 'undefined' || 
        (typeof value === 'number' && value > 0 && value < 100) || 
        'Stoploss percentage must be between 0 and 100'
    }
  );

  // Remove secret before returning
  const { secret, ...alertWithoutSecret } = alert;
  return alertWithoutSecret as TradingViewSignal;
}

/**
 * Execute trade based on webhook alert
 */
export async function executeTrade(
  exchange: any,
  alert: TradingViewSignal,
  market: any,
  price: number,
  bot: BotData
) {
  try {
    // If direct amount is specified, use it instead of calculating from balance
    if (alert.amount && alert.amount > 0) {
      logger.info('Using direct amount specified in alert', { amount: alert.amount });
      
      // Check if this is Hyperliquid exchange
      const isHyperliquid = bot.exchange.toLowerCase() === 'hyperliquid';
      
      // For Hyperliquid, we need to include a price for market orders
      // Execute the trade with the specified amount
      const order = await exchange.createOrder(
        alert.symbol,
        'market',
        alert.action.toLowerCase(),
        alert.amount,
        isHyperliquid ? price : undefined, // Include price for Hyperliquid
        {
          ...(alert.stoplossPercent ? {
            stopLoss: {
              stopPrice: price * (1 - alert.stoplossPercent/100),
              type: 'market'
            }
          } : {}),
          // Add slippage option for Hyperliquid
          ...(isHyperliquid ? { slippage: 0.05 } : {})
        }
      );
      
      return order;
    }
    
    // Get available balance
    let available = 0;
    let positionSize = 0;
    
    if (SIMULATION_MODE) {
      // In simulation mode, use a fixed balance
      logger.info('Using simulation mode with fixed balance');
      available = 10000; // $10,000 USDC for testing
    } else {
      // Real mode - fetch actual balance
      const balance = await exchange.fetchBalance();
      const currency = alert.action === 'BUY' ? 
        alert.symbol.split('/')[1] : // Quote currency for buying
        alert.symbol.split('/')[0];  // Base currency for selling
      
      available = balance[currency]?.free || 0;
      
      logger.info('Available balance', { currency, available });
    }
    
    // Use order_size from alert if provided, otherwise from bot config, or default to 100%
    const percentage = alert.order_size || bot.order_size || 100;
    
    logger.info('Using order size', { 
      percentage, 
      source: alert.order_size ? 'alert' : (bot.order_size ? 'bot config' : 'default')
    });
    
    positionSize = (available * percentage) / 100;
    const amount = positionSize / price;

    // Add minimum order size check for Hyperliquid
    let finalAmount = amount;
    const isHyperliquid = bot.exchange.toLowerCase() === 'hyperliquid';
    
    if (isHyperliquid) {
      // Calculate the order value in USD
      const orderValue = amount * price;
      
      logger.info('Checking minimum order value for Hyperliquid', { 
        orderValue,
        minimumOrderValue: 10,
        amount,
        price
      });
      
      // Hyperliquid requires a minimum order value of $10
      if (orderValue < 10) {
        logger.warn('Order value is too small for Hyperliquid, adjusting to minimum', { 
          calculatedOrderValue: orderValue, 
          minimumOrderValue: 10 
        });
        
        // Calculate the minimum amount based on the $10 minimum order value
        finalAmount = 10 / price;
        
        // Add a small buffer to ensure we meet the minimum (10% extra)
        finalAmount = finalAmount * 1.1;
        
        logger.info('Adjusted amount for minimum order size', {
          originalAmount: amount,
          adjustedAmount: finalAmount,
          adjustedValue: finalAmount * price
        });
      }
    }

    // Execute the trade
    let order;
    if (SIMULATION_MODE) {
      // Generate a simulated order response
      const orderId = `sim_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      order = {
        id: orderId,
        datetime: new Date().toISOString(),
        timestamp: Date.now(),
        status: 'closed',
        symbol: alert.symbol,
        type: 'market',
        side: alert.action.toLowerCase(),
        price: price,
        amount: finalAmount,
        filled: finalAmount,
        remaining: 0,
        cost: finalAmount * price,
        fee: {
          cost: finalAmount * price * 0.001, // 0.1% fee
          currency: alert.symbol.split('/')[1]
        },
        info: {
          simulated: true
        }
      };
      logger.info('Simulated order created', { order });
    } else {
      // Real order execution
      const isHyperliquid = bot.exchange.toLowerCase() === 'hyperliquid';
      
      order = await exchange.createOrder(
        alert.symbol,
        'market',
        alert.action.toLowerCase(),
        finalAmount,
        isHyperliquid ? price : undefined, // Include price for Hyperliquid
        {
          ...(alert.stoplossPercent ? {
            stopLoss: {
              stopPrice: price * (1 - alert.stoplossPercent/100),
              type: 'market'
            }
          } : {}),
          // Add slippage option for Hyperliquid
          ...(isHyperliquid ? { slippage: 0.05 } : {})
        }
      );
    }

    return order;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to execute trade', { error, symbol: alert.symbol, action: alert.action });
    throw new ApiError(`Failed to execute trade: ${message}`, 500);
  }
}

/**
 * Save trade to database
 */
export async function saveTrade(
  supabase: any,
  userId: string,
  botId: string,
  order: any,
  alert: TradingViewSignal,
  price: number
) {
  const trade = {
    user_id: userId,
    external_id: order.id,
    bot_id: botId,
    symbol: alert.symbol,
    side: alert.action.toLowerCase(),
    status: 'filled',
    size: order.amount,
    price: order.price || order.average || price,
    pnl: null
  };

  logger.info('Saving trade to database', { trade });

  // Insert trade into database
  const { data, error } = await supabase
    .from('trades')
    .insert(trade)
    .select()
    .single();

  if (error) {
    logger.error('Failed to save trade', { error, botId, symbol: alert.symbol });
    
    // For debugging purposes, let's log more details about the RLS issue
    if (error.message.includes('row-level security')) {
      logger.error('RLS policy violation details', { 
        userId, 
        supabaseAuthUserId: supabase.auth.user?.()?.id,
        tradeUserId: trade.user_id
      });
    }
    
    throw new ApiError(`Failed to save trade: ${error.message}`, 500);
  }

  return data;
}

/**
 * Process webhook alert
 */
export async function processWebhookAlert(
  alert: TradingViewSignal,
  bot: BotData,
  supabase: any
) {
  try {
    // If in simulation mode, use the simulation service
    if (SIMULATION_MODE) {
      logger.info('Processing webhook in simulation mode', { alert });
      return await executeSimulatedTrade(alert, bot, supabase);
    }

    // Real mode - create exchange client with proper credentials
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
    const order = await executeTrade(exchange_client, alert, isValidMarket, tradePrice, bot);

    // Save trade to database
    const trade = await saveTrade(supabase, bot.user_id, bot.id, order, alert, tradePrice);

    logger.info('Trade executed successfully', {
      botId: alert.bot_id,
      symbol: alert.symbol,
      action: alert.action,
      price: tradePrice,
      simulation: false
    });

    return trade;
  } catch (error) {
    logger.error('Failed to process webhook alert', { error, alert });
    throw error;
  }
} 