import { NextResponse } from 'next/server';
import { executeTrade } from '@/lib/exchange';
import { saveTrade } from '@/lib/database/operations';
import { logger } from '@/lib/logging';
import type { TradingViewSignal } from '@/types';

class SignalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignalValidationError';
  }
}

function validateSignal(data: unknown): TradingViewSignal {
  if (!data || typeof data !== 'object') {
    throw new SignalValidationError('Signal must be an object');
  }

  const signal = data as any;

  // Check required fields
  if (!signal.bot_id) {
    throw new SignalValidationError('Missing bot_id');
  }
  if (!signal.symbol) {
    throw new SignalValidationError('Missing symbol');
  }
  if (!signal.action) {
    throw new SignalValidationError('Missing action');
  }
  if (!signal.timestamp) {
    throw new SignalValidationError('Missing timestamp');
  }
  if (!signal.order_size) {
    throw new SignalValidationError('Missing order_size');
  }
  if (signal.position_size === undefined) {
    throw new SignalValidationError('Missing position_size');
  }

  // Validate timestamp format
  try {
    const timestamp = new Date(signal.timestamp);
    if (isNaN(timestamp.getTime())) {
      throw new Error();
    }
    // Check if timestamp is not too old (e.g., > 1 hour)
    const maxAge = 60 * 60 * 1000; // 1 hour in milliseconds
    if (Date.now() - timestamp.getTime() > maxAge) {
      throw new SignalValidationError('Signal is too old (> 1 hour)');
    }
  } catch {
    throw new SignalValidationError('Invalid timestamp format');
  }

  // Validate order_size format
  if (typeof signal.order_size !== 'string' || !signal.order_size.endsWith('%')) {
    throw new SignalValidationError('order_size must be a string ending with %');
  }
  const orderSizeValue = parseFloat(signal.order_size);
  if (isNaN(orderSizeValue) || orderSizeValue < 1 || orderSizeValue > 100) {
    throw new SignalValidationError('order_size must be between 1% and 100%');
  }

  // Validate position_size
  if (typeof signal.position_size !== 'number' || signal.position_size <= 0) {
    throw new SignalValidationError('position_size must be a positive number');
  }

  return signal as TradingViewSignal;
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const data = await request.json();
    
    // Validate signal format
    const signal = validateSignal(data);
    logger.info('Received valid trading signal', { 
      symbol: signal.symbol,
      action: signal.action,
      strategy: signal.strategy,
      timestamp: signal.timestamp
    });

    // Execute the trade
    const trade = await executeTrade(signal);
    
    // Save trade to database
    try {
      await saveTrade(trade);
      logger.info('Trade saved to database', { tradeId: trade.external_id });
    } catch (error: any) {
      logger.error('Failed to save trade', error, { trade });
      // Don't throw here as the trade was executed successfully
    }

    return NextResponse.json({ 
      success: true, 
      trade: { 
        id: trade.external_id, 
        symbol: trade.symbol,
        side: trade.side,
        status: trade.status,
        timestamp: new Date().toISOString() 
      } 
    });
  } catch (error: any) {
    logger.error('Failed to process webhook', error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
