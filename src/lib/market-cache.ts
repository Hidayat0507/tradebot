/**
 * Market Data Cache
 * 
 * This module provides a simple in-memory cache for market data
 * to reduce the number of API calls to exchanges.
 */

import { logger } from '@/lib/logging';

// Cache entry type
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache configuration
interface CacheConfig {
  // Default TTL in milliseconds (5 seconds)
  defaultTtl: number;
  // Custom TTLs for specific data types
  ttls: {
    ticker: number;    // Price data TTL
    orderBook: number; // Order book data TTL
    ohlcv: number;     // OHLCV data TTL
  };
}

// Default cache configuration
const DEFAULT_CONFIG: CacheConfig = {
  defaultTtl: 5000, // 5 seconds
  ttls: {
    ticker: 5000,    // 5 seconds for price data
    orderBook: 5000, // 5 seconds for order book
    ohlcv: 60000,    // 1 minute for OHLCV data (changes less frequently)
  }
};

/**
 * Market data cache class
 */
class MarketDataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      ttls: {
        ...DEFAULT_CONFIG.ttls,
        ...(config.ttls || {}),
      }
    };
    
    logger.info('Market data cache initialized', { 
      defaultTtl: this.config.defaultTtl,
      tickerTtl: this.config.ttls.ticker,
      orderBookTtl: this.config.ttls.orderBook,
      ohlcvTtl: this.config.ttls.ohlcv
    });
  }

  /**
   * Generate a cache key
   */
  private generateKey(exchange: string, symbol: string, dataType: string): string {
    return `${exchange.toLowerCase()}:${symbol}:${dataType}`;
  }

  /**
   * Get data from cache
   * @returns The cached data or null if not found or expired
   */
  get<T>(exchange: string, symbol: string, dataType: string): T | null {
    const key = this.generateKey(exchange, symbol, dataType);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Get the appropriate TTL for this data type
    const ttl = this.config.ttls[dataType as keyof typeof this.config.ttls] || this.config.defaultTtl;
    const now = Date.now();
    
    // Check if the entry is expired
    if (now - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set data in cache
   */
  set<T>(exchange: string, symbol: string, dataType: string, data: T): void {
    const key = this.generateKey(exchange, symbol, dataType);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear the entire cache or specific entries
   */
  clear(exchange?: string, symbol?: string, dataType?: string): void {
    if (!exchange && !symbol && !dataType) {
      // Clear entire cache
      this.cache.clear();
      logger.info('Market data cache cleared');
      return;
    }
    
    // Clear specific entries
    const prefix = [
      exchange?.toLowerCase() || '',
      symbol || '',
      dataType || '',
    ].filter(Boolean).join(':');
    
    // If we have a prefix, delete all keys that start with it
    if (prefix) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
      
      logger.info('Market data cache entries cleared', { prefix });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Create and export a singleton instance
export const marketCache = new MarketDataCache(); 