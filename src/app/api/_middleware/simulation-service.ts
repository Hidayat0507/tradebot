import { logger } from '@/lib/logging';
import type { TradingViewSignal } from '@/types';
import { BotData } from './webhook-handler';

// Simulated prices for different assets
const SIMULATED_PRICES = {
  BTC: 65000,
  ETH: 3500,
  SOL: 150,
  DEFAULT: 100
};

/**
 * Get simulated price for a symbol
 */
export function getSimulatedPrice(symbol: string): number {
  if (symbol.includes('BTC')) return SIMULATED_PRICES.BTC;
  if (symbol.includes('ETH')) return SIMULATED_PRICES.ETH;
  if (symbol.includes('SOL')) return SIMULATED_PRICES.SOL;
  return SIMULATED_PRICES.DEFAULT;
}

/**
 * Create a mock exchange client for simulation
 */
export function createMockExchangeClient() {
  return {
    createOrder: async (symbol: string, type: string, side: string, amount: number, price?: number, options?: any) => {
      const simulatedPrice = getSimulatedPrice(symbol);
      const orderId = `sim_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      return {
        id: orderId,
        datetime: new Date().toISOString(),
        timestamp: Date.now(),
        status: 'closed',
        symbol: symbol,
        type: type,
        side: side,
        price: simulatedPrice,
        amount: amount,
        filled: amount,
        remaining: 0,
        cost: amount * simulatedPrice,
        fee: {
          cost: amount * simulatedPrice * 0.001, // 0.1% fee
          currency: symbol.split('/')[1]
        },
        info: {
          simulated: true
        }
      };
    },
    fetchTicker: async (symbol: string) => {
      return {
        last: getSimulatedPrice(symbol)
      };
    }
  };
}

/**
 * Execute a simulated trade
 */
export async function executeSimulatedTrade(
  alert: TradingViewSignal,
  bot: BotData,
  supabase: any
) {
  try {
    logger.info('Executing simulated trade', { alert });
    
    // Create mock exchange client
    const exchange_client = createMockExchangeClient();
    
    // Get simulated price
    const ticker = await exchange_client.fetchTicker(alert.symbol);
    
    // Use the price from the alert if provided, otherwise use simulated market price
    const tradePrice = alert.price || ticker.last;
    logger.info('Using price for simulated trade', { 
      price: tradePrice, 
      source: alert.price ? 'alert' : 'simulated market',
      marketPrice: ticker.last
    });

    // Calculate trade amount
    let amount: number;
    
    if (alert.amount && alert.amount > 0) {
      // Use direct amount if specified
      amount = alert.amount;
      logger.info('Using direct amount specified in alert for simulation', { amount });
    } else {
      // Use a fixed balance of $10,000 for simulation
      const available = 10000;
      
      // Use position_size_percentage from alert if provided, otherwise from bot config, or default to 100%
      const percentage = alert.position_size_percentage || bot.position_size_percentage || 100;
      
      logger.info('Using position size percentage for simulation', { 
        percentage, 
        source: alert.position_size_percentage ? 'alert' : (bot.position_size_percentage ? 'bot config' : 'default')
      });
      
      const positionSize = (available * percentage) / 100;
      amount = positionSize / tradePrice;
      
      logger.info('Calculated simulated trade amount', { 
        available, 
        percentage, 
        positionSize, 
        amount 
      });
      
      // Check if this is a Hyperliquid exchange
      if (bot.exchange.toLowerCase() === 'hyperliquid') {
        // Calculate the order value in USD
        const orderValue = amount * tradePrice;
        
        logger.info('Checking minimum order value for Hyperliquid simulation', { 
          orderValue,
          minimumOrderValue: 10
        });
        
        // Hyperliquid requires a minimum order value of $10
        if (orderValue < 10) {
          logger.warn('Order value is too small for Hyperliquid simulation, adjusting to minimum', { 
            calculatedOrderValue: orderValue, 
            minimumOrderValue: 10 
          });
          
          // Calculate the minimum amount based on the $10 minimum order value
          amount = 10 / tradePrice;
        }
      }
    }

    // Execute simulated order
    const order = await exchange_client.createOrder(
      alert.symbol,
      'market',
      alert.action.toLowerCase(),
      amount,
      tradePrice,
      alert.stoplossPercent ? {
        stopLoss: {
          stopPrice: tradePrice * (1 - alert.stoplossPercent/100),
          type: 'market'
        }
      } : {}
    );

    // Create simulated trade object
    const trade = {
      id: `sim_${Date.now()}`,
      user_id: bot.user_id,
      external_id: order.id,
      bot_id: bot.id,
      symbol: alert.symbol,
      side: alert.action.toLowerCase(),
      status: 'pending',
      size: order.amount,
      price: order.price || tradePrice,
      pnl: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      simulated: true
    };
    
    // Log the simulated trade
    try {
      await supabase.from('logs').insert({
        user_id: bot.user_id,
        bot_id: bot.id,
        type: 'info',
        message: 'Simulated trade created (not saved to database)',
        details: { 
          trade,
          botName: bot.name
        },
        timestamp: new Date().toISOString()
      });
      logger.info('Simulated trade created (not saved to database)', { trade });
    } catch (logError) {
      logger.error('Failed to log simulated trade', { error: logError, trade });
    }

    return trade;
  } catch (error) {
    logger.error('Failed to execute simulated trade', { error, alert });
    throw error;
  }
} 