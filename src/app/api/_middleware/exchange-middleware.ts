import { NextRequest } from 'next/server';
import * as ccxt from 'ccxt';
import { ApiError } from './api-handler';
import { decrypt } from '@/utils/encryption';
import { logger } from '@/lib/logging';

export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
}

/**
 * Get exchange-specific options for client creation
 */
const getExchangeOptions = async (exchange: string, credentials?: ExchangeCredentials) => {
  try {
    // Base options with optional credentials
    const baseOptions = {
      apiKey: credentials?.apiKey || '',
      secret: '',
    };
    
    // Only attempt to decrypt if apiSecret is provided
    if (credentials?.apiSecret) {
      try {
        // Log the API secret format
        logger.info('API secret format in getExchangeOptions', { 
          exchange,
          apiSecretLength: credentials.apiSecret.length,
          apiSecretFormat: credentials.apiSecret.includes(':') ? 'valid' : 'invalid'
        });
        
        // Try to decrypt
        baseOptions.secret = await decrypt(credentials.apiSecret);
        
        // Log success
        logger.info('Decryption successful in getExchangeOptions', { 
          exchange,
          secretLength: baseOptions.secret.length
        });
      } catch (decryptError) {
        // Log detailed error
        logger.error('Decryption failed in getExchangeOptions', { 
          error: decryptError, 
          exchange,
          errorMessage: decryptError instanceof Error ? decryptError.message : 'Unknown error',
          stack: decryptError instanceof Error ? decryptError.stack : 'No stack trace'
        });
        
        // Try to use the API secret directly as a fallback
        // This is for backward compatibility with non-encrypted secrets
        logger.info('Attempting to use API secret directly as fallback', { exchange });
        baseOptions.secret = credentials.apiSecret;
      }
    }
    
    // Add exchange-specific options
    switch (exchange.toLowerCase()) {
      case 'binance':
        return baseOptions;
      case 'hyperliquid':
        // For Hyperliquid, we need to set the walletAddress and privateKey
        // The apiKey is used as the walletAddress, and the secret is used as the privateKey
        return {
          ...baseOptions,
          walletAddress: baseOptions.apiKey,
          privateKey: baseOptions.secret
        };
      default:
        throw new ApiError(`Unsupported exchange: ${exchange}`, 400);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to get exchange options', { error, exchange });
    throw new ApiError('Failed to configure exchange client', 500);
  }
};

/**
 * Create an exchange client with optional credentials
 */
export const createExchangeClient = async (exchange: string, credentials?: ExchangeCredentials, context?: string) => {
  try {
    // Log the attempt with detailed information
    logger.info('Attempting to create exchange client', { 
      exchange,
      context,
      hasCredentials: !!credentials,
      hasApiKey: credentials ? !!credentials.apiKey : false,
      hasApiSecret: credentials ? !!credentials.apiSecret : false,
      apiKeyLength: credentials?.apiKey ? credentials.apiKey.length : 0,
      apiSecretLength: credentials?.apiSecret ? credentials.apiSecret.length : 0
    });
    
    const options = await getExchangeOptions(exchange, credentials);
    
    // Log the options (without exposing the actual secret)
    logger.info('Exchange options created', { 
      exchange,
      hasApiKey: !!options.apiKey,
      hasSecret: !!options.secret,
      secretLength: options.secret ? options.secret.length : 0
    });
    
    let client;
    switch (exchange.toLowerCase()) {
      case 'binance':
        client = new ccxt.binance(options);
        break;
      case 'hyperliquid':
        client = new ccxt.hyperliquid(options);
        break;
      default:
        throw new ApiError(`Unsupported exchange: ${exchange}`, 400);
    }
    
    logger.info('Exchange client created successfully', { exchange });
    return client;
  } catch (error) {
    // Provide more detailed error information
    const errorDetails = {
      error,
      exchange,
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    };
    
    logger.error('Failed to create exchange client', errorDetails);
    
    // Provide more specific error messages based on the error type
    if (error instanceof ApiError) {
      throw error; // Pass through API errors
    } else if (error instanceof Error && error.message.includes('decrypt')) {
      throw new ApiError('Failed to decrypt API credentials. Please update your bot credentials.', 500);
    } else {
      throw new ApiError('Failed to create exchange client', 500);
    }
  }
};

/**
 * Format symbol according to exchange requirements
 */
function formatSymbol(exchange: ccxt.Exchange, symbol: string): string {
  try {
    if (exchange.id === 'hyperliquid') {
      // For Hyperliquid, we need to keep the full symbol format for spot trading (BASE/USDC)
      // This is different from perpetual futures which use just the base asset
      return symbol;
    }
    
    // For other exchanges, return the symbol as is
    return symbol;
  } catch (error) {
    logger.warn('Error formatting symbol', { error, symbol, exchange: exchange.id });
    // Return original symbol as fallback
    return symbol;
  }
}

/**
 * Fetch market data for a symbol
 */
export const fetchMarketData = async (exchange_client: ccxt.Exchange, symbol: string) => {
  try {
    // Format the symbol according to exchange requirements
    const formattedSymbol = formatSymbol(exchange_client, symbol);
    
    logger.info('Fetching market data', { 
      exchange: exchange_client.id, 
      originalSymbol: symbol,
      formattedSymbol
    });
    
    // Fetch ticker data
    const ticker = await exchange_client.fetchTicker(formattedSymbol);
    
    // Fetch order book
    const orderBook = await exchange_client.fetchOrderBook(formattedSymbol);
    
    // Fetch OHLCV data (1 day timeframe)
    const ohlcv = await exchange_client.fetchOHLCV(formattedSymbol, '1d', undefined, 1);
    
    return {
      symbol: symbol,
      formatted_symbol: formattedSymbol,
      last_price: ticker.last,
      bid: ticker.bid,
      ask: ticker.ask,
      volume_24h: ticker.baseVolume || ticker.quoteVolume,
      change_24h: ticker.percentage,
      high_24h: ticker.high,
      low_24h: ticker.low,
      order_book: {
        bids: orderBook.bids.slice(0, 5).map(([price, amount]) => ({ price, amount })),
        asks: orderBook.asks.slice(0, 5).map(([price, amount]) => ({ price, amount })),
      },
      ohlcv: ohlcv.length > 0 ? {
        timestamp: ohlcv[0][0],
        open: ohlcv[0][1],
        high: ohlcv[0][2],
        low: ohlcv[0][3],
        close: ohlcv[0][4],
        volume: ohlcv[0][5],
      } : null,
    };
  } catch (error) {
    logger.error('Error fetching market data', { 
      error: error instanceof Error ? error.message : String(error),
      symbol,
      exchange: exchange_client.id 
    });
    
    if (error instanceof ccxt.ExchangeError) {
      if (error.message.includes('BadSymbol')) {
        throw new ApiError(`Symbol ${symbol} not supported on ${exchange_client.id}. Please check the symbol format.`, 400);
      }
      throw new ApiError(`Exchange error: ${error.message}`, 400);
    }
    
    throw error;
  }
};

/**
 * Validate if a market exists on an exchange
 */
export async function validateMarket(exchange: ccxt.Exchange, symbol: string): Promise<boolean> {
  try {
    // Fetch markets
    const markets = await exchange.fetchMarkets();
    
    // Check if the symbol exists
    const market = markets.find(m => m && m.symbol === symbol);
    
    return !!market;
  } catch (error) {
    logger.error('Failed to validate market', { error, symbol, exchange: exchange.id });
    return false;
  }
}

/**
 * Fetch balance with exchange-specific parameters
 */
export async function fetchBalance(exchange: ccxt.Exchange, exchangeType: string, credentials: ExchangeCredentials) {
  try {
    // Log the exchange type and credentials status
    logger.info('Fetching balance', { 
      exchange: exchange.id, 
      exchangeType,
      hasApiKey: !!credentials.apiKey,
      hasApiSecret: !!credentials.apiSecret
    });
    
    // Set exchange-specific parameters
    let params;
    if (exchangeType.toLowerCase() === 'hyperliquid') {
      params = { user: credentials.apiKey };
      logger.info('Using Hyperliquid-specific params', { params });
    }
    
    // Fetch the balance
    const balance = await exchange.fetchBalance(params);
    
    // Log success
    logger.info('Balance fetched successfully', { 
      exchange: exchange.id,
      currencies: Object.keys(balance.total || {}).length
    });

    return {
      total: balance.total,
      free: balance.free,
      used: balance.used
    };
  } catch (error) {
    // Log detailed error
    logger.error('Failed to fetch balance', { 
      error, 
      exchange: exchange.id,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown'
    });
    
    // Handle specific error types
    if (error instanceof ccxt.AuthenticationError) {
      throw new ApiError('Authentication failed: Invalid API credentials', 401);
    } else if (error instanceof ccxt.PermissionDenied) {
      throw new ApiError('Permission denied: Your API key may not have permission to fetch balance', 403);
    } else if (error instanceof ccxt.ExchangeError) {
      throw new ApiError(`Exchange error: ${error.message}`, 400);
    } else if (error instanceof ccxt.NetworkError) {
      throw new ApiError('Network error: Could not connect to exchange', 503);
    }
    
    throw new ApiError('Failed to fetch balance', 500);
  }
} 