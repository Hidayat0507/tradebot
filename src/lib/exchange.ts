import * as ccxt from 'ccxt';
import type { Trade, TradeSide, SupportedExchange, TradeStatus, TradingViewSignal } from '@/types';
import { getExchangeConfig } from '@/lib/database/operations';
import { logger } from './logging';
import { notifications } from './notifications';

// Type for exchange configuration
interface ExchangeOptions {
  apiKey: string;
  secret: string;
  enableRateLimit?: boolean;
  timeout?: number;
}

// Type for CCXT exchange constructors
type ExchangeConstructor = new (config: ExchangeOptions) => ccxt.Exchange;

// Map of supported exchanges to their CCXT classes
const exchangeClasses: Record<SupportedExchange, ExchangeConstructor> = {
  binance: ccxt.binance,
  coinbase: ccxt.coinbase,
  kraken: ccxt.kraken,
}

async function validateMarket(exchange: ccxt.Exchange, symbol: string): Promise<void> {
  try {
    await exchange.loadMarkets()
    if (!(symbol in exchange.markets)) {
      throw new Error(`Symbol ${symbol} not found in ${exchange.name}`)
    }
  } catch (error: any) {
    logger.tradingError('validate_market', error, { symbol, exchange: exchange.name })
    throw new Error(`Failed to validate market: ${error?.message || 'Unknown error'}`)
  }
}

async function checkBalance(
  exchange: ccxt.Exchange, 
  symbol: string, 
  side: string, 
  amount: number,
  price: number
): Promise<void> {
  try {
    const [base, quote] = symbol.split('/')
    const balance = await exchange.fetchBalance()
    
    if (side === 'buy') {
      const required = amount * price
      const available = balance[quote]?.free || 0
      
      if (available < required) {
        throw new Error(
          `Insufficient ${quote} balance. Required: ${required}, Available: ${available}`
        )
      }
    } else {
      const available = balance[base]?.free || 0
      if (available < amount) {
        throw new Error(
          `Insufficient ${base} balance. Required: ${amount}, Available: ${available}`
        )
      }
    }
  } catch (error: any) {
    logger.tradingError('check_balance', error, { symbol, side, amount })
    throw new Error(`Failed to check balance: ${error?.message || 'Unknown error'}`)
  }
}

function calculatePositionSize(price: number, maxPositionSize: number): number {
  return maxPositionSize / price;
}

// Maximum time to wait for order verification
const ORDER_VERIFICATION_TIMEOUT = 5000;

// Valid order statuses from CCXT
type CCXTOrderStatus = 'open' | 'closed' | 'canceled';

async function verifyOrderStatus(
  exchange: ccxt.Exchange,
  orderId: string,
  symbol: string
): Promise<ccxt.Order> {
  const startTime = Date.now();
  
  while (true) {
    try {
      const order = await exchange.fetchOrder(orderId, symbol);
      
      if (order.status === 'closed') {
        return order;
      }
      
      if (order.status === 'canceled') {
        throw new Error('Order was canceled');
      }
      
      if (Date.now() - startTime > ORDER_VERIFICATION_TIMEOUT) {
        throw new Error('Order verification timeout');
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      logger.tradingError('verify_order', error, { orderId, symbol })
      throw new Error(`Failed to verify order: ${error?.message || 'Unknown error'}`)
    }
  }
}

async function executeOrderWithRetry(
  exchange: ccxt.Exchange,
  symbol: string,
  side: 'buy' | 'sell',  
  size: number
): Promise<ccxt.Order> {
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const order = await exchange.createMarketOrder(symbol, side, size);
      
      // Verify the order was executed
      const verifiedOrder = await verifyOrderStatus(exchange, order.id, symbol);
      
      logger.info('Order executed', {
        symbol,
        side,
        size,
        price: verifiedOrder.price,
        cost: verifiedOrder.cost
      });
      
      return verifiedOrder;
      
    } catch (error: any) {
      lastError = error;
      logger.tradingError('execute_order', error, {
        symbol,
        side,
        size,
        attempt
      });
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(
    `Failed to execute order after ${maxRetries} attempts: ${lastError?.message}`
  );
}

async function calculateStoplossPrice(
  signal: TradingViewSignal,
  entryPrice: number
): Promise<number | null> {
  if (signal.stoploss) {
    return signal.stoploss;
  }
  
  if (signal.stoplossPercent) {
    const multiplier = signal.action === 'BUY' 
      ? (1 - signal.stoplossPercent / 100)
      : (1 + signal.stoplossPercent / 100);
    return entryPrice * multiplier;
  }
  
  return null;
}

async function placeStoplossOrder(
  exchange: ccxt.Exchange,
  symbol: string,
  side: 'buy' | 'sell',
  quantity: number,
  stopPrice: number
): Promise<ccxt.Order> {
  try {
    const stopSide = side === 'buy' ? 'sell' : 'buy';
    
    const order = await exchange.createOrder(symbol, 'stop', stopSide, quantity, undefined, {
      stopPrice,
      type: 'stop_market'
    });
    
    logger.info('Stoploss order placed', {
      symbol,
      side: stopSide,
      quantity,
      stopPrice
    });
    
    return order;
    
  } catch (error: any) {
    logger.tradingError('place_stoploss', error, {
      symbol,
      side,
      quantity,
      stopPrice
    });
    throw error;
  }
}

export async function executeTrade(signal: TradingViewSignal): Promise<Omit<Trade, 'id' | 'created_at' | 'updated_at'>> {
  try {
    // For testing, use mock config and responses
    const mockConfig = {
      exchange: 'binance' as const,
      api_key: 'test',
      api_secret: 'test',
      user_id: 'test_user'
    };

    // Mock exchange with test responses
    const mockExchange = {
      name: 'Binance',
      markets: {
        'BTC/USDT': { symbol: 'BTC/USDT', active: true },
        'ETH/USDT': { symbol: 'ETH/USDT', active: true }
      },
      has: {
        createMarketOrder: true,
        createOrder: true,
        fetchBalance: true,
        fetchTicker: true
      },
      loadMarkets: async () => mockExchange.markets,
      fetchBalance: async () => ({
        USDT: { free: 10000, used: 0, total: 10000 },
        BTC: { free: 1, used: 0, total: 1 }
      }),
      fetchTicker: async (symbol: string) => ({
        symbol,
        last: 50000, // Mock BTC price
        bid: 49900,
        ask: 50100
      }),
      createOrder: async (symbol: string, type: string, side: string, amount: number, price?: number, params = {}) => {
        const orderId = 'test_order_' + Date.now();
        return {
          id: orderId,
          symbol,
          type,
          side,
          amount,
          price: price || 50000,
          status: 'closed',
          filled: amount,
          remaining: 0,
          timestamp: Date.now(),
          datetime: new Date().toISOString(),
          lastTradeTimestamp: Date.now(),
          cost: amount * (price || 50000),
          average: price || 50000,
          info: {}
        };
      },
      fetchOrder: async (id: string, symbol: string) => {
        return {
          id,
          symbol,
          type: 'market',
          side: 'buy',
          amount: 0.1,
          price: 50000,
          status: 'closed',
          filled: 0.1,
          remaining: 0,
          timestamp: Date.now(),
          datetime: new Date().toISOString(),
          lastTradeTimestamp: Date.now(),
          cost: 5000,
          average: 50000,
          info: {}
        };
      }
    };

    // Use mock exchange instead of real one
    const exchange = {
      ...mockExchange,
      createMarketOrder: (symbol: string, side: string, amount: number, price?: number, params = {}) => 
        mockExchange.createOrder(symbol, 'market', side, amount, price, params)
    } as unknown as ccxt.Exchange;

    // Prepare order parameters
    const market = signal.symbol.replace('USDT', '/USDT');
    await validateMarket(exchange, market);

    // Get current price if not provided
    const ticker = await exchange.fetchTicker(market);
    const entryPrice = signal.price || ticker.last;
    if (!entryPrice) {
      throw new Error('Could not determine entry price');
    }

    // Calculate order size
    const orderSize = signal.position_size;
    if (orderSize <= 0) {
      throw new Error('Invalid order size');
    }

    // Execute the order
    logger.info('Executing order', {
      symbol: market,
      side: signal.action.toLowerCase(),
      size: orderSize
    });

    const order = await executeOrderWithRetry(
      exchange,
      market,
      signal.action.toLowerCase() as 'buy' | 'sell',
      orderSize
    );

    // Place stoploss if specified
    let stoplossOrder = null;
    if (signal.stoploss || signal.stoplossPercent) {
      const stoplossPrice = await calculateStoplossPrice(signal, entryPrice);
      if (stoplossPrice) {
        const stoplossSide = signal.action === 'BUY' ? 'sell' : 'buy';
        stoplossOrder = await placeStoplossOrder(
          exchange,
          market,
          stoplossSide,
          orderSize,
          stoplossPrice
        );
      }
    }

    // Create trade record
    const trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'> = {
      external_id: order.id,
      user_id: mockConfig.user_id,
      bot_id: signal.bot_id,
      symbol: signal.symbol,
      side: signal.action as TradeSide,
      price: entryPrice,
      size: orderSize,
      status: 'OPEN' as TradeStatus,
      pnl: null
    };

    return trade;
  } catch (error: any) {
    logger.tradingError('Failed to execute trade', error);
    throw error;
  }
}
