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

  const alert = { ...(data as Record<string, unknown>) };

  // Convert action to lowercase if it exists
  if (typeof alert.action === 'string') {
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
  delete (alert as Record<string, unknown>).secret;
  const alertWithoutSecret = alert as Record<string, unknown>;
  
  // Build strongly typed result
  const result: TradingViewSignal = {
    bot_id: String(alertWithoutSecret.bot_id),
    symbol: String(alertWithoutSecret.symbol),
    action: String(alertWithoutSecret.action) as TradingViewSignal['action'],
    price: alertWithoutSecret.price as number | undefined,
    strategy: alertWithoutSecret.strategy as string | undefined,
    stoplossPercent: alertWithoutSecret.stoplossPercent as number | undefined,
    amount: alertWithoutSecret.amount as number | undefined,
    order_size: alertWithoutSecret.order_size as number | undefined,
  };
  
  if (typeof (result.price as unknown) === 'string') {
    result.price = parseFloat(result.price as unknown as string);
  }
  
  if (typeof (result.stoplossPercent as unknown) === 'string') {
    result.stoplossPercent = parseFloat(result.stoplossPercent as unknown as string);
  }
  
  if (typeof (result.amount as unknown) === 'string') {
    result.amount = parseFloat(result.amount as unknown as string);
  }
  
  if (typeof (result.order_size as unknown) === 'string') {
    result.order_size = parseFloat(result.order_size as unknown as string);
  }

  logger.info('Webhook alert validated', {
    botId: result.bot_id,
    symbol: result.symbol,
    action: result.action
  });
  
  return result;
} 
