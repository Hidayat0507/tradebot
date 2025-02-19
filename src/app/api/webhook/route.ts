import { NextResponse } from 'next/server';
import { executeTrade } from '@/lib/exchange';
import { saveTrade } from '@/lib/database/operations';
import { logger } from '@/lib/logging';
import type { TradingViewSignal } from '@/types';

interface TradingViewAlert {
  symbol: string
  action: 'BUY' | 'SELL'
  price?: number
  strategy?: string
  stoplossPercent?: number
  bot_id: string
}

class SignalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignalValidationError';
  }
}

function validateAlert(data: unknown): TradingViewSignal {
  if (!data || typeof data !== 'object') {
    throw new SignalValidationError('Alert must be an object');
  }

  const alert = data as any;

  // Check required fields
  if (!alert.bot_id) {
    throw new SignalValidationError('Missing bot_id');
  }
  if (!alert.symbol) {
    throw new SignalValidationError('Missing symbol');
  }
  if (!alert.action || !['BUY', 'SELL'].includes(alert.action)) {
    throw new SignalValidationError('Invalid or missing action (must be BUY or SELL)');
  }

  // Add required fields with default values if not provided
  if (!alert.timestamp) {
    alert.timestamp = new Date().toISOString();
  }
  if (!alert.order_size) {
    alert.order_size = '100%';
  }
  if (!alert.position_size) {
    alert.position_size = 1;
  }

  // Validate stoploss if present
  if (alert.stoplossPercent !== undefined) {
    const stoploss = Number(alert.stoplossPercent);
    if (isNaN(stoploss) || stoploss < 0) {
      throw new SignalValidationError('Invalid stoploss percentage');
    }
  }

  return alert as TradingViewSignal;
}

export async function POST(request: Request) {
  try {
    // Parse and validate the alert
    const data = await request.json();
    const alert = validateAlert(data);

    // Execute the trade
    const trade = await executeTrade(alert);

    // Save trade to database
    await saveTrade(trade);

    logger.info('Trade executed successfully', {
      botId: alert.bot_id,
      symbol: alert.symbol,
      action: alert.action,
      price: alert.price
    });

    return NextResponse.json({ success: true, trade });
  } catch (error) {
    if (error instanceof SignalValidationError) {
      logger.warn('Invalid webhook alert', { error: error.message });
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    logger.error('Failed to process webhook', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
