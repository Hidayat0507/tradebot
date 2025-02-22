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

import { createClient } from '@/utils/supabase/client'

// Simple logger implementation
export const logger = {
  info: async (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta || '');
    await saveLog('info', message, meta);
  },
  error: async (message: string, error?: any, meta?: any) => {
    console.error(`[ERROR] ${message}`, error || '', meta || '');
    await saveLog('error', message, { ...meta, error });
  },
  warn: async (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta || '');
    await saveLog('warning', message, meta);
  },
  debug: async (message: string, meta?: any) => {
    console.debug(`[DEBUG] ${message}`, meta || '');
    await saveLog('info', message, meta);
  },
  tradingError: async (message: string, error?: any, meta?: any) => {
    console.error(`[TRADING_ERROR] ${message}`, error || '', meta || '');
    await saveLog('error', message, { ...meta, error, type: 'trading' });
  },
  webhookError: async (error: Error, meta?: any) => {
    console.error(`[WEBHOOK_ERROR] ${error.message}`, {
      name: error.name,
      stack: error.stack,
      ...meta
    });
    await saveLog('error', error.message, { ...meta, error, type: 'webhook' });
  }
};

// Helper function to save log to database
async function saveLog(
  type: 'info' | 'warning' | 'error' | 'success',
  message: string,
  details?: any
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('logs').insert({
      user_id: user.id,
      bot_id: details?.botId,
      type,
      message,
      details,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to save log:', error)
  }
}

// Helper methods for common logging patterns
export const logTrade = async (action: string, details: any) => {
  const message = `Trade ${action.toUpperCase()}`
  await logger.info(message, {
    ...details,
    type: 'trade',
    timestamp: new Date().toISOString()
  });
};

export const logBalance = async (action: string, details: any) => {
  const message = `Balance ${action.toUpperCase()}`
  await logger.info(message, {
    ...details,
    type: 'balance',
    timestamp: new Date().toISOString()
  });
};

export const logError = async (error: Error, context?: any) => {
  await logger.error(error.message, error, {
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
