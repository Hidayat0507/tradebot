import { NextRequest } from 'next/server';
import { ApiError } from '@/app/api/_middleware/api-handler';
import { 
  getAuthenticatedUser,
  handleApiError,
  successResponse
} from '@/app/api/_middleware/api-handler';
import {
  createExchangeClient,
  fetchBalance,
  ExchangeCredentials
} from '@/app/api/_middleware/exchange-middleware';
import { decrypt } from '@/utils/encryption';
import { logger } from '@/lib/logging';

export async function GET(request: NextRequest) {
  try {
    // Get bot ID from query params
    const botId = new URL(request.url).searchParams.get('botId');
    if (!botId) {
      throw new ApiError('Bot ID required', 400);
    }

    // Get authenticated user and bot credentials
    const { user, supabase } = await getAuthenticatedUser(request);
    
    const { data: bot, error } = await supabase
      .from('bots')
      .select('exchange, api_key, api_secret')
      .eq('id', botId)
      .eq('user_id', user.id)
      .single();

    if (error || !bot) {
      logger.error('Bot not found for balance fetch', { error, botId, userId: user.id });
      throw new ApiError('Bot not found', 404);
    }

    // Diagnostic logging for API secret
    logger.info('API secret diagnostic', { 
      botId,
      hasApiSecret: !!bot.api_secret,
      apiSecretLength: bot.api_secret ? bot.api_secret.length : 0,
      apiSecretFormat: bot.api_secret ? (bot.api_secret.includes(':') ? 'valid' : 'invalid') : 'none'
    });

    // Test decryption directly
    if (bot.api_secret) {
      try {
        const decrypted = await decrypt(bot.api_secret);
        logger.info('Decryption test successful', { 
          botId,
          decryptedLength: decrypted.length,
          decryptedPreview: decrypted.substring(0, 3) + '...'
        });
      } catch (decryptError) {
        logger.error('Decryption test failed', { 
          error: decryptError, 
          botId,
          errorMessage: decryptError instanceof Error ? decryptError.message : 'Unknown error'
        });
      }
    }

    // Validate that we have the required credentials
    if (!bot.api_key || !bot.api_secret) {
      logger.error('Missing API credentials for balance fetch', { botId, userId: user.id });
      throw new ApiError('Please add API credentials to your bot to fetch balance', 400);
    }

    // Create exchange client with credentials
    const credentials: ExchangeCredentials = {
      apiKey: bot.api_key,
      apiSecret: bot.api_secret
    };

    try {
      // Log the attempt to create the exchange client
      logger.info('Creating exchange client for balance fetch', { 
        exchange: bot.exchange, 
        botId, 
        hasApiKey: !!bot.api_key,
        hasApiSecret: !!bot.api_secret
      });
      
      const exchange_client = await createExchangeClient(bot.exchange, credentials);
      
      // Log successful client creation
      logger.info('Successfully created exchange client', { exchange: bot.exchange, botId });
      
      const balance = await fetchBalance(exchange_client, bot.exchange, credentials);
      return successResponse({ balance });
    } catch (clientError: any) {
      // Provide more specific error message based on the error
      if (clientError instanceof ApiError) {
        if (clientError.message.includes('decrypt')) {
          logger.error('Decryption error during balance fetch', { 
            error: clientError, 
            exchange: bot.exchange,
            botId,
            userId: user.id
          });
          throw new ApiError('Failed to decrypt API credentials. Please update your bot credentials.', 500);
        } else if (clientError.message.includes('Authentication failed')) {
          throw new ApiError('Invalid API credentials. Please check your API key and secret.', 401);
        } else if (clientError.message.includes('Permission denied')) {
          throw new ApiError('Your API key does not have permission to fetch balance. Please check your API key permissions.', 403);
        } else {
          // Pass through the original API error
          throw clientError;
        }
      }
      
      logger.error('Exchange client or balance fetch error', { 
        error: clientError, 
        errorMessage: clientError.message,
        exchange: bot.exchange,
        botId,
        userId: user.id
      });
      throw new ApiError('Failed to fetch balance from exchange. Please check your API credentials and try again.', 500);
    }
  } catch (error) {
    logger.error('Failed to fetch balance', { error });
    return handleApiError(error);
  }
}
