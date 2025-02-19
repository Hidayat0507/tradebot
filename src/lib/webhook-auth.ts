import { createHmac, timingSafeEqual } from 'crypto';
import { headers } from 'next/headers';
import { logger } from './logging';
import { type TradingViewSignal } from '@/types';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const MAX_TIMESTAMP_DIFF = 5 * 60 * 1000; // 5 minutes in milliseconds

if (!WEBHOOK_SECRET) {
  throw new Error('WEBHOOK_SECRET environment variable is required');
}
if (WEBHOOK_SECRET.length < 32) {
  throw new Error('WEBHOOK_SECRET must be at least 32 characters long for security');
}

export class WebhookAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookAuthError';
  }
}

export class SignalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignalValidationError';
  }
}

function generateSignature(payload: string, timestamp: string): string {
  // WEBHOOK_SECRET is guaranteed to be defined by the check above
  const hmac = createHmac('sha256', WEBHOOK_SECRET!);
  hmac.update(`${timestamp}.${payload}`);
  return hmac.digest('hex');
}

export function validateSignal(data: unknown): TradingViewSignal {
  try {
    if (!data || typeof data !== 'object') {
      throw new SignalValidationError('Signal must be an object');
    }

    const signal = data as any;

    // Check required fields
    if (!signal.symbol) {
      throw new SignalValidationError('Missing symbol');
    }
    if (!signal.action) {
      throw new SignalValidationError('Missing action');
    }
    if (!signal.price || typeof signal.price !== 'number') {
      throw new SignalValidationError('Invalid or missing price');
    }
    if (!signal.strategy) {
      throw new SignalValidationError('Missing strategy name');
    }

    // Validate action
    if (signal.action !== 'BUY' && signal.action !== 'SELL') {
      throw new SignalValidationError('Action must be BUY or SELL');
    }

    // Validate symbol format (basic check)
    if (!/^[A-Z]+$/.test(signal.symbol.replace(/USDT$/, ''))) {
      throw new SignalValidationError('Invalid symbol format');
    }

    // Validate price
    if (signal.price <= 0) {
      throw new SignalValidationError('Price must be greater than 0');
    }

    logger.info('Signal validated successfully', {
      symbol: signal.symbol,
      action: signal.action,
      strategy: signal.strategy
    });

    return signal as TradingViewSignal;
  } catch (error) {
    if (error instanceof SignalValidationError) {
      throw error;
    }
    // Type guard for error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SignalValidationError(`Invalid signal: ${errorMessage}`);
  }
}

export async function verifyWebhookRequest(request: Request): Promise<any> {
  try {
    const headersList = await headers();
    const signature = headersList.get('x-tradingview-signature');
    const timestamp = headersList.get('x-tradingview-timestamp');

    if (!signature) {
      const error = new WebhookAuthError('Missing webhook signature');
      logger.webhookError(error);
      throw error;
    }

    if (!timestamp) {
      const error = new WebhookAuthError('Missing webhook timestamp');
      logger.webhookError(error);
      throw error;
    }

    // Verify timestamp is recent
    const timestampMs = parseInt(timestamp, 10);
    if (isNaN(timestampMs)) {
      const error = new WebhookAuthError('Invalid timestamp format');
      logger.webhookError(error);
      throw error;
    }

    const now = Date.now();
    const diff = Math.abs(now - timestampMs);
    if (diff > MAX_TIMESTAMP_DIFF) {
      const error = new WebhookAuthError('Webhook timestamp too old');
      logger.webhookError(error, { diff, maxDiff: MAX_TIMESTAMP_DIFF });
      throw error;
    }

    // Get and verify payload
    const payload = await request.text();
    const expectedSignature = generateSignature(payload, timestamp);
    
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      const error = new WebhookAuthError('Invalid webhook signature');
      logger.webhookError(error);
      throw error;
    }

    // Parse and return the body
    try {
      const data = JSON.parse(payload);
      const signal = validateSignal(data);
      logger.webhookSuccess({ timestamp });
      return signal;
    } catch (error) {
      if (error instanceof SignalValidationError) {
        throw error;
      }
      const parseError = new WebhookAuthError('Invalid JSON payload');
      logger.webhookError(parseError, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        payload 
      });
      throw parseError;
    }
  } catch (error) {
    if (error instanceof WebhookAuthError || error instanceof SignalValidationError) {
      throw error;
    }
    const unknownError = new WebhookAuthError('Webhook verification failed');
    logger.webhookError(unknownError, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw unknownError;
  }
}
