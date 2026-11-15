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

  // Accept complete decimal strings (including exponents), never a numeric prefix.
  // Normalize once so validation and the returned signal use the same value.
  for (const field of ['price', 'amount', 'stoplossPercent', 'order_size']) {
    const value = alert[field];
    if (typeof value === 'string') {
      const text = value.trim();
      alert[field] = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)
        ? Number(text) : NaN;
    }
  }

  // Convert action to lowercase if it exists
  if (typeof alert.action === 'string') {
    alert.action = alert.action.toLowerCase();
  }

  // Validate required fields and format
  validateFields(
    alert,
    ['bot_id', 'symbol', 'action', 'secret', 'ts', 'alert_id'],
    {
      action: (value) =>
        (typeof value === 'string' && ['buy', 'sell'].includes(value)) ||
        'Invalid action (must be buy or sell)',
      price: (value) => {
        const numValue = value;
        return typeof numValue === 'undefined' ||
          (typeof numValue === 'number' && Number.isFinite(numValue) && numValue > 0) ||
          'Price must be a positive number';
      },
      amount: (value) =>
        typeof value === 'undefined' ||
        (typeof value === 'number' && Number.isFinite(value) && value > 0) ||
        'Amount must be a positive number',
      stoplossPercent: (value) => {
        const numValue = value;
        return typeof numValue === 'undefined' ||
          (typeof numValue === 'number' && Number.isFinite(numValue) && numValue > 0 && numValue < 100) ||
          'Stoploss percentage must be between 0 and 100';
      },
      order_size: (value) => {
        const numValue = value;
        return typeof numValue === 'undefined' ||
          (typeof numValue === 'number' && Number.isFinite(numValue) && numValue > 0 && numValue <= 100) ||
          'order_size must be a percent of balance between 0 and 100';
      }
    }
  );

  const windowSeconds = Number(process.env.WEBHOOK_REPLAY_WINDOW_SECONDS ?? 60);
  if (!Number.isFinite(windowSeconds) || windowSeconds <= 0) {
    throw new ApiError('Invalid webhook replay window configuration', 500);
  }
  // TradingView {{timenow}} is an ISO timestamp; numeric timestamps use Unix seconds.
  const ts = typeof alert.ts === 'number' ? alert.ts * 1000
    : typeof alert.ts === 'string' && /^\d+(\.\d+)?$/.test(alert.ts)
      ? Number(alert.ts) * 1000
      : typeof alert.ts === 'string' ? Date.parse(alert.ts) : NaN;
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > windowSeconds * 1000) {
    throw new ApiError('Alert timestamp is invalid or outside the replay window', 400);
  }
  if (typeof alert.alert_id !== 'string' || !alert.alert_id.trim() || alert.alert_id.length > 256) {
    throw new ApiError('alert_id must be a nonempty string of at most 256 characters', 400);
  }

  // Remove secret before returning
  delete (alert as Record<string, unknown>).secret;
  const alertWithoutSecret = alert as Record<string, unknown>;

  // Build strongly typed result
  const result: TradingViewSignal = {
    ts: new Date(ts).toISOString(),
    alert_id: alert.alert_id.trim(),
    bot_id: String(alertWithoutSecret.bot_id),
    symbol: String(alertWithoutSecret.symbol),
    action: String(alertWithoutSecret.action) as TradingViewSignal['action'],
    price: alertWithoutSecret.price as number | undefined,
    strategy: alertWithoutSecret.strategy as string | undefined,
    stoplossPercent: alertWithoutSecret.stoplossPercent as number | undefined,
    amount: alertWithoutSecret.amount as number | undefined,
    order_size: alertWithoutSecret.order_size as number | undefined,
  };

  logger.info('Webhook alert validated', {
    botId: result.bot_id,
    symbol: result.symbol,
    action: result.action
  });

  return result;
}
