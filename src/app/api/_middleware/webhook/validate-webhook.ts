import type { TradingViewSignal } from '@/types';
import { ApiError, validateFields } from '../api-handler';
import { logger } from '@/lib/logging';

/**
 * Validate webhook alert data
 */
export function validateWebhookAlert(data: unknown): TradingViewSignal {
  if (!data || typeof data !== 'object') {
    throw new ApiError('Alert must be an object', 400);
  }

  const alert = data as any;

  // Convert action to lowercase if it exists
  if (alert.action) {
    alert.action = alert.action.toLowerCase();
  }

  // Validate required fields and format
  validateFields(
    alert,
    ['bot_id', 'symbol', 'action', 'secret'],
    {
      action: (value) => 
        (typeof value === 'string' && ['buy', 'sell'].includes(value)) || 
        'Invalid action (must be buy or sell)',
      price: (value) => {
        // Convert string to number if needed
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        return typeof numValue === 'undefined' || 
          (typeof numValue === 'number' && !isNaN(numValue) && numValue > 0) || 
          'Price must be a positive number';
      },
      stoplossPercent: (value) => {
        // Convert string to number if needed
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        return typeof numValue === 'undefined' || 
          (typeof numValue === 'number' && !isNaN(numValue) && numValue > 0 && numValue < 100) || 
          'Stoploss percentage must be between 0 and 100';
      },
      order_size: (value) => {
        // Convert string to number if needed
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        return typeof numValue === 'undefined' || 
          (typeof numValue === 'number' && !isNaN(numValue) && numValue > 0) || 
          'Order size must be a positive number';
      }
    }
  );

  // Remove secret before returning
  delete alert.secret;
  const alertWithoutSecret = alert;
  
  // Convert string values to numbers
  const result = { ...alertWithoutSecret } as TradingViewSignal;
  
  if (typeof result.price === 'string') {
    result.price = parseFloat(result.price);
  }
  
  if (typeof result.stoplossPercent === 'string') {
    result.stoplossPercent = parseFloat(result.stoplossPercent);
  }
  
  if (typeof result.amount === 'string') {
    result.amount = parseFloat(result.amount);
  }
  
  if (typeof result.order_size === 'string') {
    result.order_size = parseFloat(result.order_size);
  }

  logger.info('Webhook alert validated', {
    botId: result.bot_id,
    symbol: result.symbol,
    action: result.action
  });
  
  return result;
} 
