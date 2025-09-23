import type { TradingViewSignal } from '@/types';
import { ApiError } from '../api-handler';
import { logger, normalizeError } from '@/lib/logging';

export interface BotData {
  id: string;
  exchange: string;
  api_key: string;
  api_secret: string;
  user_id: string;
  webhook_secret: string;
  order_size?: number; // Percentage of available balance to use (25, 50, 75, or 100)
  name: string;
  password?: string; // Bitget passphrase
}

/**
 * Execute direct amount trade
 */
async function executeDirectAmountTrade(
  exchange: any,
  alert: TradingViewSignal,
  price: number,
  isHyperliquid: boolean
) {
  // Order type is limit only if price is provided in the alert
  const orderType = alert.price ? 'limit' : 'market';
  
  logger.info('Using direct amount specified in alert', { 
    amount: alert.amount,
    symbol: alert.symbol,
    action: alert.action,
    type: orderType,
    price: alert.price,
    exchange: exchange.id
  });
  
  const orderOptions = {
    ...(alert.stoplossPercent ? {
      stopLoss: {
        stopPrice: price * (1 - alert.stoplossPercent/100),
        type: 'market'
      }
    } : {}),
    ...(isHyperliquid ? { slippage: 0.05 } : {})
  };
  
  // For market orders: pass price for Hyperliquid and for BUY on exchanges like Bitget that require price
  const orderPrice = orderType === 'limit'
    ? alert.price
    : (isHyperliquid || alert.action === 'buy' ? price : undefined);

  return await exchange.createOrder(
    alert.symbol,
    orderType,
    alert.action.toLowerCase(),
    alert.amount,
    orderPrice,
    orderOptions
  );
}

/**
 * Calculate trade amount based on available balance and percentage
 */
async function calculateTradeAmount(
  exchange: any,
  alert: TradingViewSignal,
  price: number,
  bot: BotData
): Promise<number> {
  const isHyperliquid = bot.exchange.toLowerCase() === 'hyperliquid';
  
  // Determine market type: swap symbols in CCXT usually contain ':' (e.g., BTC/USDT:USDT)
  const isSwap = alert.symbol.includes(':');
  const marketType = isSwap ? 'swap' : 'spot';
  
  // Determine currency for balance based on exchange and side
  // - Hyperliquid BUY: USDC (quote). SELL: base (e.g., UETH)
  // - Other exchanges BUY: quote (e.g., USDT). SELL: base (e.g., BTC)
  let currency: string;
  if (isHyperliquid) {
    if (alert.action === 'buy') {
      currency = 'USDC';
    } else {
      currency = alert.symbol.split('/')[0];
    }
  } else {
    if (alert.action === 'buy') {
      currency = alert.symbol.split('/')[1] || 'USDT';
    } else {
      currency = alert.symbol.split('/')[0];
    }
  }
  
  logger.info('Starting balance calculation', {
    action: alert.action,
    currency,
    isHyperliquid,
    marketType,
    symbol: alert.symbol,
    exchangeId: exchange.id,
    hasApiKey: !!exchange.apiKey,
    hasWalletAddress: !!exchange.walletAddress,
    options: exchange.options
  });
  
  // Try to get balance following the same pattern as in bot-balance.tsx
  let balance;
  try {
    if (isHyperliquid) {
      // For Hyperliquid, use correct market type and user parameters
      logger.info('Fetching Hyperliquid balance', {
        type: marketType,
        user: bot.api_key,
        currency
      });
      
      balance = await exchange.fetchBalance({
        type: marketType,  // 'spot' or 'swap' based on market type
        user: bot.api_key  // Use apiKey as wallet address for Hyperliquid
      });
      
      logger.info('Hyperliquid balance fetch result', {
        hasBalance: !!balance[currency],
        hasFree: balance[currency]?.free !== undefined,
        balanceDetails: balance[currency],
        allCurrencies: Object.keys(balance).filter(k => !k.startsWith('_') && k !== 'info')
      });
    } else {
      // For other exchanges, try normal balance fetch
      balance = await exchange.fetchBalance({
        type: marketType
      });
    }
    
    // If currency not found, throw error
    if (!balance[currency] || balance[currency]?.free === undefined) {
      throw new Error(`Currency ${currency} not found in ${marketType} balance`);
    }
  } catch (err: any) {
    const normalizedError = normalizeError(err)
    logger.error('Failed to fetch balance', normalizedError, {
      currency,
      marketType,
      exchange: exchange.id
    })
    throw new Error(`Failed to fetch ${currency} ${marketType} balance: ${normalizedError.message}`);
  }
  
  // Get available balance
  const available = balance[currency].free;
  
  // Calculate order size percentage
  const percentage = bot.order_size || 100; // Default to 100% if not specified
  
  logger.info('Starting amount calculation', {
    availableBalance: available,
    currency,
    percentage,
    price,
    action: alert.action,
    isHyperliquid,
    balanceInfo: balance[currency],
    allBalances: Object.keys(balance).map(key => ({
      currency: key,
      balance: balance[key]?.free
    }))
  });
  
  // Calculate position size
  const positionSize = (available * percentage) / 100;
  logger.info('Calculated position size', {
    positionSize,
    currency,
    calculation: `(${available} * ${percentage}) / 100`,
    rawPositionSize: positionSize,
    roundedPositionSize: Math.floor(positionSize * 100000) / 100000
  });
  
  // For BUY orders, convert quote balance to base amount
  let amount = positionSize;
  if (alert.action === 'buy') {
    amount = positionSize / price;
    logger.info('Converted quote to base amount for BUY', {
      positionSizeQuote: positionSize,
      price,
      calculation: `${positionSize} / ${price}`,
      rawAmount: amount,
      isHyperliquid
    });

    // Round down to 5 decimals for Hyperliquid; keep raw for others
    if (isHyperliquid) {
      amount = Math.floor(amount * 100000) / 100000;
      logger.info('Rounded amount to 5 decimals (Hyperliquid)', {
        roundedAmount: amount
      });
    }
  }
  
  // Only use minimum value as fallback if amount is invalid
  if (!amount || amount <= 0) {
    logger.warn('Invalid amount calculated, using fallback minimum value', {
      calculatedAmount: amount,
      using: 'fallback minimum value'
    });
    
    const minOrderValue = 10; // $10 minimum as fallback
    amount = (minOrderValue * 1.1) / price;
    
    // Round down to 5 decimal places for Hyperliquid
    if (isHyperliquid) {
      amount = Math.floor(amount * 100000) / 100000;
    }
    
    logger.info('Using fallback minimum amount', {
      fallbackAmount: amount,
      fallbackOrderValueUSD: amount * price
    });
  }
  
  // Log final calculation details
  logger.info('Final trade amount calculation', {
    initialBalance: available,
    percentage,
    positionSize,
    price,
    finalAmount: amount,
    finalOrderValueUSD: amount * price
  });
  
  if (!amount || amount <= 0) {
    throw new Error('Invalid trade amount calculated: ' + amount);
  }
  
  return amount;
}

/**
 * Execute real order
 */
async function executeRealOrder(
  exchange: any,
  alert: TradingViewSignal,
  amount: number,
  price: number,
  isHyperliquid: boolean
) {
  // Define the order type based on whether price is provided in the alert
  const orderType = alert.price ? 'limit' : 'market';
  
  // For limit orders, use the alert price
  // For market orders: pass price for Hyperliquid and for BUY on exchanges like Bitget that require price
  const orderPrice = orderType === 'limit'
    ? alert.price
    : (isHyperliquid || alert.action === 'buy' ? price : undefined);
  
  logger.info('Creating order', { 
    type: orderType, 
    symbol: alert.symbol, 
    action: alert.action,
    amount: amount,
    price: orderPrice, 
    exchange: exchange.id
  });
  
  const orderOptions = {
    ...(alert.stoplossPercent ? {
      stopLoss: {
        stopPrice: price * (1 - alert.stoplossPercent/100),
        type: 'market'
      }
    } : {}),
    ...(isHyperliquid ? { slippage: 0.05 } : {})
  };

  // Add detailed logging of exact values and their types
  logger.info('Order parameters detail', {
    symbol: {
      value: alert.symbol,
      type: typeof alert.symbol
    },
    orderType: {
      value: orderType,
      type: typeof orderType
    },
    side: {
      value: alert.action.toLowerCase(),
      type: typeof alert.action
    },
    amount: {
      value: amount,
      type: typeof amount,
      asString: amount.toString(),
      asPreciseString: amount.toPrecision(10),
      asFixedString: amount.toFixed(8)
    },
    price: {
      value: orderPrice,
      type: typeof orderPrice,
      asString: orderPrice?.toString(),
      asPreciseString: orderPrice?.toPrecision(10),
      asFixedString: orderPrice?.toFixed(2)
    },
    options: {
      value: orderOptions,
      type: typeof orderOptions,
      keys: Object.keys(orderOptions)
    }
  });
  
  // According to CCXT documentation:
  // For limit orders: must provide symbol, 'limit', side, amount, price
  // For market orders: must provide symbol, 'market', side, amount
  const order = await exchange.createOrder(
    alert.symbol,
    orderType,
    alert.action.toLowerCase(),
    amount,
    orderPrice,
    orderOptions
  );

  logger.info('Order created successfully', {
    orderId: order.id,
    type: orderType,
    symbol: alert.symbol,
    action: alert.action,
    requestedAmount: amount,
    actualAmount: order.amount,
    filledAmount: order.filled,
    price: order.price || order.average,
    status: order.status,
    remaining: order.remaining,
    exchange: exchange.id
  });

  return order;
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
    const isHyperliquid = bot.exchange.toLowerCase() === 'hyperliquid';

    // For Hyperliquid, we need to set credentials correctly
    if (isHyperliquid) {
      // Set credentials in CCXT format
      exchange.options = {
        ...exchange.options,
        apiKey: bot.api_key,         // Wallet address
        secret: bot.api_secret,      // Private key
        privateKey: bot.api_secret,  // Private key for signing
        walletAddress: bot.api_key   // Required for order signing
      };
      
      logger.info('Set Hyperliquid credentials', {
        walletAddress: bot.api_key,
        hasPrivateKey: !!exchange.options.privateKey
      });
    }

    let calculatedAmount: number;

    // If direct amount specified, use that
    if (alert.amount && alert.amount > 0) {
      calculatedAmount = alert.amount;
      const order = await executeDirectAmountTrade(exchange, alert, price, isHyperliquid);
      return { order, calculatedAmount };
    }
    
    // Calculate amount based on balance and percentage
    calculatedAmount = await calculateTradeAmount(exchange, alert, price, bot);
    
    // Execute real order
    const order = await executeRealOrder(exchange, alert, calculatedAmount, price, isHyperliquid);
    return { order, calculatedAmount };
  } catch (error: unknown) {
    const normalizedError = normalizeError(error)
    logger.error('Failed to execute trade', normalizedError, { symbol: alert.symbol, action: alert.action })
    throw new ApiError(`Failed to execute trade: ${normalizedError.message}`, 500);
  }
}
