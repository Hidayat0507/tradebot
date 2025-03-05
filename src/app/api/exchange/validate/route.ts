import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { validateAndStoreCredentials, ExchangeError } from '@/app/api/_middleware/exchange';
import type { SupportedExchange } from '@/lib/database/schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, apiSecret, exchange, botId } = body;

    // Validate required fields
    if (!exchange) {
      throw new ExchangeError('Exchange is required', 400);
    }

    if (!botId) {
      throw new ExchangeError('Bot ID is required', 400);
    }

    // For Hyperliquid, apiKey is the wallet address
    if (!apiKey) {
      throw new ExchangeError(
        exchange === 'hyperliquid' 
          ? 'Wallet address is required' 
          : 'API key is required',
        400
      );
    }

    // Validate and store credentials
    const result = await validateAndStoreCredentials(
      request,
      botId,
      apiKey,
      apiSecret || '', // Use empty string for Hyperliquid
      exchange as SupportedExchange
    );

    return NextResponse.json(result);
  } catch (error: any) {
    // Use statusCode from ExchangeError if available
    const status = error instanceof ExchangeError ? error.statusCode : 500;
    const message = error.message || 'Failed to validate exchange credentials';
    
    return NextResponse.json({ error: message }, { status });
  }
}
