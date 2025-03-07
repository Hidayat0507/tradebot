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
      price: (value) => {
        if (typeof value === 'undefined') return true;
        
        // Convert string prices to numbers
        if (typeof value === 'string') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && numValue > 0) {
            alert.price = numValue; // Update the alert with the numeric value
            return true;
          }
          return 'Price must be a positive number';
        }
        
        return (typeof value === 'number' && value > 0) || 
          'Price must be a positive number';
      },
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
    // Determine if we should create a limit order or market order
    // If price is provided in the alert, use a limit order
    const orderType = alert.price ? 'limit' : 'market';
    
    logger.info(`Creating ${orderType} order`, { 
      symbol: alert.symbol, 
      action: alert.action,
      price: alert.price || price
    });
    
    // If direct amount is specified, use it instead of calculating from balance
    if (alert.amount && alert.amount > 0) {
      logger.info('Using direct amount specified in alert', { amount: alert.amount });
      
      // Check if this is Hyperliquid exchange
      const isHyperliquid = bot.exchange.toLowerCase() === 'hyperliquid';
      
      // Execute the trade with the specified amount
      const order = await exchange.createOrder(
        alert.symbol,
        orderType,
        alert.action.toLowerCase(),
        alert.amount,
        alert.price || (isHyperliquid ? price : undefined), // Use provided price for limit orders
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
      
      // Add detailed logging of the full balance object
      logger.info('Raw balance from exchange', { exchangeId: exchange.id });
      
      // Parse the symbol carefully
      const symbolParts = alert.symbol.split('/');
      const baseCurrency = symbolParts[0]; // e.g., UBTC
      const quoteCurrency = symbolParts[1]; // e.g., USDC
      
      logger.info('Symbol parsing', {
        fullSymbol: alert.symbol,
        parsedBaseCurrency: baseCurrency,
        parsedQuoteCurrency: quoteCurrency
      });
      
      const currency = alert.action === 'BUY' ? 
        quoteCurrency : // Quote currency for buying
        baseCurrency;  // Base currency for selling
      
      logger.info('Currency determination', {
        action: alert.action,
        selectedCurrency: currency
      });
      
      // Handle common currency variations (e.g., USDC might be listed as USDC.e)
      const currencyVariations = getCurrencyVariations(currency);
      let matchedCurrency = currency;
      
      // Search for any matching variation in the balance
      for (const variation of currencyVariations) {
        if (balance[variation] && balance[variation].free > 0) {
          matchedCurrency = variation;
          logger.info('Found currency variation in balance', {
            originalCurrency: currency,
            matchedVariation: variation,
            availableBalance: balance[variation].free
          });
          break;
        }
      }
      
      // Check if currency exists in balance (using matched variation)
      if (!balance[matchedCurrency]) {
        logger.error('Currency not found in balance', { 
          currency: matchedCurrency, 
          originalCurrency: currency,
          availableCurrencies: Object.keys(balance).filter(k => typeof balance[k] === 'object')
        });
        throw new ApiError(`Currency ${currency} not found in balance`, 400);
      }
      
      available = balance[matchedCurrency]?.free || 0;
      
      logger.info('Available balance', { 
        currency: matchedCurrency, 
        available,
        total: balance[matchedCurrency]?.total || 0,
        used: balance[matchedCurrency]?.used || 0
      });
    }
    
    // Use order_size from alert if provided, otherwise from bot config, or default to 100%
    const percentage = alert.order_size || bot.order_size || 100;
    
    logger.info('Using order size', { 
      percentage, 
      source: alert.order_size ? 'alert' : (bot.order_size ? 'bot config' : 'default')
    });
    
    positionSize = (available * percentage) / 100;
    const amount = positionSize / price;
    
    logger.info('Calculated order details', {
      availableBalance: available,
      percentage: percentage,
      positionSizeInUSD: positionSize,
      calculatedAmount: amount,
      price: price,
      orderValue: amount * price
    });

    // Handle minimum order size for Hyperliquid
    let finalAmount = amount;
    const isHyperliquid = bot.exchange.toLowerCase() === 'hyperliquid';
    
    // Enforce a fixed minimum amount for Hyperliquid - this is the simplest approach
    // that works with their requirements
    if (isHyperliquid) {
      // A fixed amount that should be large enough to meet Hyperliquid's minimum requirements
      // but small enough to not waste funds
      const MIN_AMOUNT = 0.0002; // Approximately $17-18 at current BTC prices
      
      // Only use the minimum if calculated amount is smaller or zero
      if (finalAmount <= 0 || finalAmount < MIN_AMOUNT) {
        logger.warn('Using minimum viable order size for Hyperliquid', {
          calculatedAmount: finalAmount,
          minimumAmount: MIN_AMOUNT,
          valueInUSD: MIN_AMOUNT * price
        });
        finalAmount = MIN_AMOUNT;
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
        status: orderType === 'limit' ? 'open' : 'closed',
        symbol: alert.symbol,
        type: orderType,
        side: alert.action.toLowerCase(),
        price: alert.price || price,
        amount: finalAmount,
        filled: orderType === 'limit' ? 0 : finalAmount,
        remaining: orderType === 'limit' ? finalAmount : 0,
        cost: finalAmount * (alert.price || price),
        fee: {
          cost: finalAmount * (alert.price || price) * 0.001, // 0.1% fee
          currency: alert.symbol.split('/')[1]
        },
        info: {
          simulated: true
        }
      };
      logger.info('Simulated order created', { order });
    } else {
      // Real order execution
      logger.info('Executing real order', {
        symbol: alert.symbol,
        type: orderType,
        side: alert.action.toLowerCase(),
        amount: finalAmount,
        price: alert.price || (isHyperliquid ? price : undefined),
        exchange: exchange.id
      });
      
      order = await exchange.createOrder(
        alert.symbol,
        orderType,
        alert.action.toLowerCase(),
        finalAmount,
        alert.price || (isHyperliquid ? price : undefined), // Use provided price for limit orders
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
      
      logger.info('Order created successfully', {
        orderId: order.id,
        status: order.status,
        filledAmount: order.filled,
        cost: order.cost
      });
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
  // Ensure we have a valid size value from multiple possible sources
  const orderSize = order.amount || order.filled || order.size || (alert.amount || 0);
  
  const trade = {
    user_id: userId,
    external_id: order.id,
    bot_id: botId,
    symbol: alert.symbol,
    side: alert.action.toLowerCase(),
    status: 'filled',
    size: orderSize,
    price: order.price || order.average || price,
    pnl: null
  };

  // Log the size determination for debugging
  logger.info('Trade size determination', {
    orderAmount: order.amount,
    orderFilled: order.filled,
    orderSize: order.size,
    alertAmount: alert.amount,
    finalSize: orderSize
  });

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
      market_price: ticker.last
    });

    // Execute the trade - pass isValidMarket as the market parameter
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

// Helper function to get common variations of currency names
function getCurrencyVariations(currency: string): string[] {
  const variations = [currency];
  
  // Add common variations
  if (currency === 'USDC') {
    variations.push('USDC.e', 'USDT', 'USD', 'USDH');
  } else if (currency === 'UBTC') {
    variations.push('BTC', 'WBTC', 'BTC-PERP', 'BTC-USDC-PERP');
  } else if (currency === 'ETH') {
    variations.push('WETH', 'ETH-PERP', 'ETH-USDC-PERP');
  }
  
  return variations;
} 