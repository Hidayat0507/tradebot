import { NextRequest } from 'next/server';
import * as ccxt from 'ccxt';
import { ApiError } from './api-handler';
import { decrypt } from '@/utils/encryption';
import { logger } from '@/lib/logging';
import { marketCache } from '@/lib/market-cache';

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
    
    // Create a result object to store the data
    const result: any = {
      symbol: symbol,
      formatted_symbol: formattedSymbol,
    };
    
    // Check cache for ticker data
    const cachedTicker = marketCache.get<ccxt.Ticker>(exchange_client.id, symbol, 'ticker');
    if (cachedTicker) {
      logger.info('Using cached ticker data', { 
        exchange: exchange_client.id, 
        symbol
      });
      
      // Use cached ticker data
      result.last_price = cachedTicker.last;
      result.bid = cachedTicker.bid;
      result.ask = cachedTicker.ask;
      result.volume_24h = cachedTicker.baseVolume || cachedTicker.quoteVolume;
      result.change_24h = cachedTicker.percentage;
      result.high_24h = cachedTicker.high;
      result.low_24h = cachedTicker.low;
    } else {
      // Fetch ticker data from exchange
      logger.info('Fetching ticker data', { 
        exchange: exchange_client.id, 
        symbol
      });
      
      const ticker = await exchange_client.fetchTicker(formattedSymbol);
      
      // Cache the ticker data
      marketCache.set(exchange_client.id, symbol, 'ticker', ticker);
      
      // Use fresh ticker data
      result.last_price = ticker.last;
      result.bid = ticker.bid;
      result.ask = ticker.ask;
      result.volume_24h = ticker.baseVolume || ticker.quoteVolume;
      result.change_24h = ticker.percentage;
      result.high_24h = ticker.high;
      result.low_24h = ticker.low;
    }
    
    // Check cache for order book data
    const cachedOrderBook = marketCache.get<ccxt.OrderBook>(exchange_client.id, symbol, 'orderBook');
    if (cachedOrderBook) {
      logger.info('Using cached order book data', { 
        exchange: exchange_client.id, 
        symbol
      });
      
      // Use cached order book data
      result.order_book = {
        bids: cachedOrderBook.bids.slice(0, 5).map(([price, amount]) => ({ price, amount })),
        asks: cachedOrderBook.asks.slice(0, 5).map(([price, amount]) => ({ price, amount })),
      };
    } else {
      // Fetch order book from exchange
      logger.info('Fetching order book data', { 
        exchange: exchange_client.id, 
        symbol
      });
      
      const orderBook = await exchange_client.fetchOrderBook(formattedSymbol);
      
      // Cache the order book data
      marketCache.set(exchange_client.id, symbol, 'orderBook', orderBook);
      
      // Use fresh order book data
      result.order_book = {
        bids: orderBook.bids.slice(0, 5).map(([price, amount]) => ({ price, amount })),
        asks: orderBook.asks.slice(0, 5).map(([price, amount]) => ({ price, amount })),
      };
    }
    
    // Check cache for OHLCV data
    const cachedOHLCV = marketCache.get<number[][]>(exchange_client.id, symbol, 'ohlcv');
    if (cachedOHLCV) {
      logger.info('Using cached OHLCV data', { 
        exchange: exchange_client.id, 
        symbol
      });
      
      // Use cached OHLCV data
      result.ohlcv = cachedOHLCV.length > 0 ? {
        timestamp: cachedOHLCV[0][0],
        open: cachedOHLCV[0][1],
        high: cachedOHLCV[0][2],
        low: cachedOHLCV[0][3],
        close: cachedOHLCV[0][4],
        volume: cachedOHLCV[0][5],
      } : null;
    } else {
      // Fetch OHLCV data from exchange
      logger.info('Fetching OHLCV data', { 
        exchange: exchange_client.id, 
        symbol
      });
      
      const ohlcv = await exchange_client.fetchOHLCV(formattedSymbol, '1d', undefined, 1);
      
      // Cache the OHLCV data
      marketCache.set(exchange_client.id, symbol, 'ohlcv', ohlcv);
      
      // Use fresh OHLCV data
      result.ohlcv = ohlcv.length > 0 ? {
        timestamp: ohlcv[0][0],
        open: ohlcv[0][1],
        high: ohlcv[0][2],
        low: ohlcv[0][3],
        close: ohlcv[0][4],
        volume: ohlcv[0][5],
      } : null;
    }
    
    return result;
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
    // Check if we have cached markets for this exchange
    const cachedMarkets = marketCache.get<ccxt.Market[]>(exchange.id, 'all', 'markets');
    
    if (cachedMarkets) {
      logger.info('Using cached markets for validation', { 
        exchange: exchange.id, 
        symbol,
        marketsCount: cachedMarkets.length
      });
      
      // Check if the symbol exists in cached markets
      const market = cachedMarkets.find(m => m && m.symbol === symbol);
      return !!market;
    }
    
    // No cached markets, fetch from exchange
    logger.info('Fetching markets for validation', { exchange: exchange.id, symbol });
    const markets = await exchange.fetchMarkets();
    
    // Cache the markets for future use
    marketCache.set(exchange.id, 'all', 'markets', markets);
    
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