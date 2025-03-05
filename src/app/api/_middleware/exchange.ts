import * as ccxt from 'ccxt';
import { createClient } from '@/utils/supabase/server';
import { encrypt } from '@/utils/encryption';
import type { SupportedExchange } from '@/types';
import { NextRequest } from 'next/server';

export class ExchangeError extends Error {
  constructor(message: string, public statusCode: number = 500, public help?: string) {
    super(message);
    this.name = 'ExchangeError';
  }
}

export async function createExchangeClient(apiKey: string, apiSecret: string, exchange: SupportedExchange): Promise<ccxt.Exchange> {
  if (!apiKey) {
    throw new ExchangeError('API key is required', 400);
  }
  
  // For Hyperliquid, we only need the wallet address (apiKey)
  if (exchange !== 'hyperliquid' && !apiSecret) {
    throw new ExchangeError('API secret is required', 400);
  }

  try {
    // Initialize exchange with rate limiting enabled (default)
    const client = new ccxt[exchange]({
      apiKey,
      secret: apiSecret || '', // Use empty string as fallback for Hyperliquid
      enableRateLimit: true,
    });

    // Load markets to validate exchange connection
    await client.loadMarkets();
    
    return client;
  } catch (error: any) {
    console.error('Error initializing exchange client:', error);
    if (error instanceof ccxt.AuthenticationError) {
      throw new ExchangeError('Invalid API credentials', 401);
    }
    if (error instanceof ccxt.PermissionDenied) {
      throw new ExchangeError('API key does not have required permissions', 403);
    }
    if (error instanceof ccxt.RateLimitExceeded) {
      throw new ExchangeError('Rate limit exceeded - please try again later', 429);
    }
    if (error instanceof ccxt.NetworkError) {
      throw new ExchangeError('Network error - please check your connection', 503);
    }
    // Log the actual error for debugging
    console.error('Detailed error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    throw new ExchangeError(`Failed to initialize exchange client: ${error.message}`, 500);
  }
}

export async function validateAndStoreCredentials(
  request: NextRequest,
  botId: string,
  apiKey: string,
  apiSecret: string,
  exchange: SupportedExchange
): Promise<{ success: boolean, message: string }> {
  try {
    // Validate credentials
    if (!apiKey) {
      throw new ExchangeError('API key is required', 400);
    }
    
    // For non-Hyperliquid exchanges, we need both key and secret
    if (exchange !== 'hyperliquid' && !apiSecret) {
      throw new ExchangeError('API secret is required', 400);
    }
    
    // Use the standard validation for all exchanges
    const client = await createExchangeClient(apiKey, apiSecret, exchange);
    
    // Special handling for Hyperliquid fetchBalance
    if (exchange === 'hyperliquid') {
      await client.fetchBalance({ user: apiKey }); // Use apiKey as wallet address
    } else {
      await client.fetchBalance();
    }

    // Encrypt the API secret if provided
    let encryptedSecret = null;
    if (apiSecret) {
      try {
        encryptedSecret = await encrypt(apiSecret);
      } catch (encryptError) {
        console.error('Failed to encrypt API secret:', encryptError);
        throw new ExchangeError('Failed to encrypt API credentials', 500);
      }
    }

    // Update the bot with credentials
    const supabase = await createClient(request);
    const { error } = await supabase
      .from('bots')
      .update({
        api_key: apiKey,
        api_secret: encryptedSecret
      })
      .eq('id', botId);

    if (error) {
      throw new ExchangeError(`Failed to store exchange credentials: ${error.message}`, 500);
    }

    return { success: true, message: 'API validated successfully' };
  } catch (error: any) {
    // If it's already an ExchangeError, rethrow it
    if (error instanceof ExchangeError) {
      throw error;
    }
    // Otherwise wrap it in an ExchangeError
    throw new ExchangeError(`Exchange validation failed: ${error.message}`, 500);
  }
}
