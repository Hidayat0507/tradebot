import { NextRequest } from 'next/server';
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
import { logger } from '@/lib/logging';

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the alert
    const data = await request.json();
    
    console.log('Raw webhook request payload:', JSON.stringify(data));
    
    const alert = validateWebhookAlert(data);

    // Log the incoming request for debugging
    console.log('Validated webhook alert:', {
      botId: alert.bot_id,
      botIdType: typeof alert.bot_id,
      botIdLength: alert.bot_id.length,
      symbol: alert.symbol,
      action: alert.action
    });

    // Initialize Supabase clients
    const supabase = await createClient(request);
    const serviceClient = createServiceClient();

    // Log a message before database query
    console.log('Querying database for bot with ID:', alert.bot_id);
    
    // Direct debug query to list all bots
    console.log('Listing available bots:');
    const { data: allBots, error: listError } = await serviceClient
      .from('bots')
      .select('id, name')
      .limit(10);
      
    if (allBots && allBots.length > 0) {
      console.log('Available bots:');
      allBots.forEach(b => console.log(`- ID: "${b.id}" (${b.id.length} chars), Name: ${b.name}`));
    } else {
      console.log('No bots found in database:', listError);
    }
    
    // Try exact match first
    logger.debug('Trying exact match with ID:', JSON.stringify(alert.bot_id));
    let { data: bot, error } = await serviceClient
      .from('bots')
      .select('id, exchange, api_key, api_secret, user_id, webhook_secret, name, max_position_size')
      .eq('id', alert.bot_id)
      .single();
      
    if (error || !bot) {
      // Try with trimmed ID
      const trimmedId = alert.bot_id.trim();
      logger.debug('Trying with trimmed ID:', JSON.stringify(trimmedId));
      
      ({ data: bot, error } = await serviceClient
        .from('bots')
        .select('id, exchange, api_key, api_secret, user_id, webhook_secret, name, max_position_size')
        .eq('id', trimmedId)
        .single());
        
      if (error || !bot) {
        // Try case insensitive as last resort
        logger.debug('Trying case-insensitive match as last resort');
        ({ data: bot, error } = await serviceClient
          .from('bots')
          .select('id, exchange, api_key, api_secret, user_id, webhook_secret, name, max_position_size')
          .ilike('id', alert.bot_id)
          .single());
      }
    }

    if (error || !bot) {
      // Log more details about the failed query
      console.error('Bot not found with ID:', alert.bot_id);
      throw new ApiError('Bot not found', 404);
    }

    console.log('Bot found:', {
      id: bot.id,
      name: bot.name,
      exchange: bot.exchange
    });

    // Verify webhook secret
    console.log('Verifying webhook secret:');
    console.log('- Received secret:', data.secret ? `${data.secret.substring(0, 8)}...` : 'none');
    console.log('- Expected secret:', bot.webhook_secret ? `${bot.webhook_secret.substring(0, 8)}...` : 'none');
    console.log('- Match:', data.secret === bot.webhook_secret);
    
    if (data.secret !== bot.webhook_secret) {
      console.warn('Invalid webhook secret provided');
      throw new ApiError('Invalid webhook secret', 401);
    }

    console.log('Webhook secret verified, processing alert');

    // Use order_size from webhook or max_position_size from bot config
    const botWithOrderSize = {
      ...bot,
      order_size: alert.order_size || bot.max_position_size || 100 // Use webhook order_size, fallback to max_position_size, then 100%
    };

    // Process the webhook alert
    const trade = await processWebhookAlert(alert, botWithOrderSize, serviceClient);

    return successResponse({ success: true, trade });
  } catch (error) {
    console.error('Failed to process webhook', error);
    return handleApiError(error);
  }
}
    