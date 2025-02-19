import * as ccxt from 'ccxt';
import { createClient } from '@/utils/supabase/server';

export class ExchangeError extends Error {
  constructor(message: string, public statusCode: number = 500, public help?: string) {
    super(message);
    this.name = 'ExchangeError';
  }
}

export async function createExchangeClient(userId: string): Promise<ccxt.binance> {
  if (!userId) {
    throw new ExchangeError('User ID is required', 401);
  }

  // Get API credentials from database
  const supabase = await createClient();
  const { data: config, error: dbError } = await supabase
    .from('exchange_config')
    .select('api_key, api_secret')
    .eq('user_id', userId)
    .single();

  if (dbError) {
    console.error('Database error:', dbError);
    throw new ExchangeError('Failed to fetch exchange configuration', 500);
  }
  
  if (!config) {
    throw new ExchangeError(
      'No API credentials found',
      404,
      'Please configure your exchange API credentials in the settings page'
    );
  }

  if (!config.api_key || !config.api_secret) {
    throw new ExchangeError(
      'Invalid API credentials',
      400,
      'Please check your exchange API credentials in the settings page'
    );
  }

  // Initialize Binance client
  try {
    return new ccxt.binance({
      apiKey: config.api_key,
      secret: config.api_secret,
      enableRateLimit: true,
    });
  } catch (error) {
    console.error('Exchange client creation error:', error);
    throw new ExchangeError('Failed to initialize exchange client', 500);
  }
}

export async function validateExchangeCredentials(apiKey: string, apiSecret: string): Promise<void> {
  if (!apiKey || !apiSecret) {
    throw new ExchangeError('API key and secret are required', 400);
  }

  try {
    const exchange = new ccxt.binance({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
    });

    // Test API credentials by fetching account info
    await exchange.fetchBalance();
  } catch (error) {
    if (error instanceof ccxt.AuthenticationError) {
      throw new ExchangeError('Invalid API credentials', 401);
    }
    throw new ExchangeError('Failed to validate exchange credentials', 500);
  }
}
