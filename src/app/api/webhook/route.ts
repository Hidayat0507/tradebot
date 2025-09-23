import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
import { ApiError } from '@/app/api/_middleware/api-handler';
import { 
  handleApiError,
  successResponse
} from '@/app/api/_middleware/api-handler';
import { 
  validateWebhookAlert,
  processWebhookAlert
} from '@/app/api/_middleware/webhook';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { logger, normalizeError } from '@/lib/logging';

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the alert
    const data = await request.json();
    
    logger.debug('Raw webhook request payload', { payloadPreview: JSON.stringify(data).slice(0, 500) });
    
    const alert = validateWebhookAlert(data);

    // Log the incoming request for debugging
    logger.debug('Validated webhook alert', {
      botId: alert.bot_id,
      botIdType: typeof alert.bot_id,
      botIdLength: alert.bot_id.length,
      symbol: alert.symbol,
      action: alert.action
    });

    // Initialize Supabase clients
    const _supabase = await createClient(request);
    const serviceClient = createServiceClient();

    // Log a message before database query
    logger.debug('Querying database for bot', { botId: alert.bot_id });
    
    // Direct debug query to list all bots
    logger.debug('Listing available bots');
    const { data: allBots, error: listError } = await serviceClient
      .from('bots')
      .select('id, name')
      .limit(10);
      
    if (allBots && allBots.length > 0) {
      logger.debug('Available bots summary', { bots: allBots.map(b => ({ id: b.id, name: b.name, len: b.id.length })) });
    } else {
      logger.warn('No bots found in database', { error: listError });
    }
    
    // Try exact match first
    logger.debug('Trying exact match with ID', { botId: alert.bot_id });
    let { data: bot, error } = await serviceClient
      .from('bots')
      .select('id, exchange, api_key, api_secret, password, enabled, user_id, webhook_secret, name, max_position_size')
      .eq('id', alert.bot_id)
      .single();
      
    if (error || !bot) {
      // Try with trimmed ID
      const trimmedId = alert.bot_id.trim();
      logger.debug('Trying with trimmed ID', { botId: trimmedId });
      
        ({ data: bot, error } = await serviceClient
          .from('bots')
          .select('id, exchange, api_key, api_secret, password, enabled, user_id, webhook_secret, name, max_position_size')
        .eq('id', trimmedId)
        .single());
        
      if (error || !bot) {
        // Try case insensitive as last resort
        logger.debug('Trying case-insensitive match as last resort');
        ({ data: bot, error } = await serviceClient
          .from('bots')
          .select('id, exchange, api_key, api_secret, password, enabled, user_id, webhook_secret, name, max_position_size')
          .ilike('id', alert.bot_id)
          .single());
      }
    }

    if (error || !bot) {
      // Log more details about the failed query
      logger.warn('Bot not found with ID', { botId: alert.bot_id, error });
      throw new ApiError('Bot not found', 404);
    }

    logger.info('Bot found for webhook', { id: bot.id, name: bot.name, exchange: bot.exchange });

    // Enforce enabled flag
    if ((bot as any).enabled === false) {
      logger.warn('Bot is disabled; rejecting webhook', { botId: bot.id });
      throw new ApiError('Bot is disabled', 403);
    }

    // Verify webhook secret
    logger.debug('Verifying webhook secret', {
      received: data.secret ? `${data.secret.substring(0, 4)}***` : 'none',
      expected: bot.webhook_secret ? `${bot.webhook_secret.substring(0, 4)}***` : 'none'
    });
    
    if (data.secret !== bot.webhook_secret) {
      console.warn('Invalid webhook secret provided');
      throw new ApiError('Invalid webhook secret', 401);
    }

    logger.info('Webhook secret verified, processing alert', { botId: bot.id });

    // Use order_size from webhook or max_position_size from bot config
    const botWithOrderSize = {
      ...bot,
      order_size: alert.order_size || bot.max_position_size || 100 // Use webhook order_size, fallback to max_position_size, then 100%
    };

    // Process the webhook alert
    const trade = await processWebhookAlert(alert, botWithOrderSize, serviceClient);

    return successResponse({ success: true, trade });
  } catch (error) {
    logger.error('Failed to process webhook', normalizeError(error));
    return handleApiError(error);
  }
}
    
