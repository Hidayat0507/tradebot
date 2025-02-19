// Log levels
const levels = {
  error: 0,    // Errors that need immediate attention
  warn: 1,     // Warnings that might need attention
  trade: 2,    // All trade-related activities
  balance: 3,  // Balance checks and updates
  info: 4,     // General information
  debug: 5     // Detailed debugging information
};

// Custom colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  trade: 'green',
  balance: 'blue',
  info: 'white',
  debug: 'gray'
};

// Simple logger implementation
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta || '');
  },
  error: (message: string, error?: any, meta?: any) => {
    console.error(`[ERROR] ${message}`, error || '', meta || '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta || '');
  },
  debug: (message: string, meta?: any) => {
    console.debug(`[DEBUG] ${message}`, meta || '');
  },
  tradingError: (message: string, error?: any, meta?: any) => {
    console.error(`[TRADING_ERROR] ${message}`, error || '', meta || '');
  },
  webhookError: (error: Error, meta?: any) => {
    console.error(`[WEBHOOK_ERROR] ${error.message}`, {
      name: error.name,
      stack: error.stack,
      ...meta
    });
  }
};

// Helper methods for common logging patterns
export const logTrade = (action: string, details: any) => {
  logger.info(`${action.toUpperCase()}`, {
    ...details,
    timestamp: new Date().toISOString()
  });
};

export const logBalance = (action: string, details: any) => {
  logger.info(`${action.toUpperCase()}`, {
    ...details,
    timestamp: new Date().toISOString()
  });
};

export const logError = (error: Error, context?: any) => {
  logger.error(error.message, error, {
    ...context,
    timestamp: new Date().toISOString()
  });
};

// Example usage:
/*
logTrade('buy', {
  symbol: 'BTCUSDT',
  price: 40000,
  amount: 0.1,
  orderId: '123'
});

logBalance('check', {
  symbol: 'USDT',
  available: 1000,
  required: 500
});

logError(new Error('Order failed'), {
  orderId: '123',
  symbol: 'BTCUSDT'
});
*/
