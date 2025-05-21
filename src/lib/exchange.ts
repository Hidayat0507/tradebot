import * as ccxt from 'ccxt';
import type { Trade, TradeSide, SupportedExchange, TradeStatus, TradingViewSignal, Bot } from '@/types';
import { logger } from './logging';
import { notifications } from './notifications';
import { decrypt } from '@/utils/encryption';

// Map of supported exchanges to their CCXT classes
const exchangeClasses: Record<SupportedExchange, typeof ccxt.Exchange> = {
  binance: ccxt.binance,
  hyperliquid: ccxt.hyperliquid,
  bitget: ccxt.bitget
};

export class TradeError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'TradeError';
  }
}

export async function executeTrade(signal: TradingViewSignal, bot: Bot): Promise<Omit<Trade, 'id' | 'created_at' | 'updated_at'>> {
  try {
    // Initialize exchange
    const ExchangeClass = exchangeClasses[bot.exchange as SupportedExchange];
    if (!ExchangeClass) {
      throw new TradeError(`Exchange ${bot.exchange} not supported`, 'UNSUPPORTED_EXCHANGE');
    }

    const exchange = new ExchangeClass({
      apiKey: decrypt(bot.api_key),
      secret: decrypt(bot.api_secret),
      enableRateLimit: true
    });

    // Load markets to validate symbol and get precision info
    await exchange.loadMarkets();
    const market = exchange.markets[signal.symbol];
    if (!market) {
      throw new TradeError(`Symbol ${signal.symbol} not found on ${bot.exchange}`, 'INVALID_SYMBOL');
    }

    // Verify market order support
    if (!exchange.has['createMarketOrder']) {
      throw new TradeError('Market orders not supported by exchange', 'UNSUPPORTED_ORDER_TYPE');
    }

    try {
      // Get current market price if not provided
      const ticker = await exchange.fetchTicker(signal.symbol);
      const price = signal.price || ticker.last;
      if (!price) {
        throw new TradeError('Could not determine trade price', 'PRICE_UNAVAILABLE');
      }

      // Get available balance
      const balance = await exchange.fetchBalance();
      const currency = signal.action === 'buy' ? 
        signal.symbol.split('/')[1] : // Quote currency for buying
        signal.symbol.split('/')[0];  // Base currency for selling
      
      const available = balance[currency]?.free || 0;
      
      // Use configured percentage or default to 100% of available balance
      const percentage = bot.order_size || 100;
      if (percentage < 25 || percentage > 100 || percentage % 25 !== 0) {
        throw new TradeError('Position size percentage must be 25, 50, 75, or 100', 'INVALID_PERCENTAGE');
      }
      
      const positionSize = (available * percentage) / 100;
      
      // Calculate amount based on market type
      let amount;
      if (market.contractSize) {
        // For contract/futures markets, convert to number of contracts
        amount = Math.floor(positionSize / (price * market.contractSize));
        if (amount < 1) {
          throw new TradeError(
            `Amount ${amount} is less than minimum contract size of 1`,
            'INVALID_AMOUNT'
          );
        }
      } else {
        // For spot markets, calculate base currency amount
        amount = positionSize / price;
      }

      // Validate balance before trading
      if (available < positionSize) {
        throw new TradeError(
          `Insufficient ${currency} balance. Required: ${positionSize}, Available: ${available}`,
          'INSUFFICIENT_BALANCE'
        );
      }

      // Prepare order parameters according to CCXT specs
      const orderParams: any = {};

      // Add stop loss if specified and supported
      if (signal.stoplossPercent && exchange.has['stopLoss']) {
        const multiplier = signal.action === 'buy' ? 
          (1 - signal.stoplossPercent/100) : 
          (1 + signal.stoplossPercent/100);
        
        orderParams.stopLoss = {
          stopPrice: price * multiplier, // This is the trigger price
          type: 'market'  // Use market order for stop loss
        };
      }

      // Execute the trade using CCXT unified API
      const order = await exchange.createOrder(
        signal.symbol,           // Unified CCXT market symbol
        'market',               // Order type
        signal.action.toLowerCase(),  // buy or sell
        amount,                 // Amount in base currency
        undefined,             // Price not needed for market orders
        orderParams            // Additional parameters including stop loss
      );

      // Create trade record matching database schema
      return {
        user_id: bot.user_id,
        external_id: order.id,
        bot_id: bot.id,
        symbol: signal.symbol,
        side: signal.action,
        status: 'OPEN',
        size: order.amount,
        price: order.price || order.average || price,
        pnl: null
      };

    } catch (error: any) {
      // Handle specific CCXT errors
      if (error instanceof ccxt.InsufficientFunds) {
        throw new TradeError('Insufficient funds for trade', 'INSUFFICIENT_FUNDS', error.message);
      }
      if (error instanceof ccxt.InvalidOrder) {
        throw new TradeError('Invalid order parameters', 'INVALID_ORDER', error.message);
      }
      if (error instanceof ccxt.OrderNotFound) {
        throw new TradeError('Order not found', 'ORDER_NOT_FOUND', error.message);
      }
      if (error instanceof ccxt.RateLimitExceeded) {
        throw new TradeError('Rate limit exceeded', 'RATE_LIMIT', error.message);
      }
      if (error instanceof ccxt.NetworkError) {
        throw new TradeError('Network error', 'NETWORK_ERROR', error.message);
      }
      throw error;
    }
  } catch (error: any) {
    // Log error with details
    logger.tradingError('execute_trade', error, {
      botId: bot.id,
      symbol: signal.symbol,
      action: signal.action,
      errorCode: error.code,
      errorDetails: error.details
    });
    throw error;
  }
}
