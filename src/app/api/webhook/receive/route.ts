import { NextRequest } from 'next/server';
import { ApiError } from '@/app/api/_middleware/api-handler';
import { 
  handleApiError,
  successResponse
} from '@/app/api/_middleware/api-handler';
import { validateWebhookAlert } from '@/app/api/_middleware/webhook';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logging';

export async function POST(request: NextRequest) {
  // TEMPORARILY DISABLED: Queue-based webhook system is not in use currently.
  // All webhook processing is being handled by the original /api/webhook endpoint.
  // To re-enable, uncomment the code below and remove this return statement.
  return successResponse({
    status: 'error',
    message: 'This endpoint is temporarily disabled. Please use /api/webhook endpoint instead.',
    disabled: true
  });

  /* Original implementation:
  const startTime = Date.now();
  
  try {
    // Parse and validate the alert
    const data = await request.json();
    
    logger.info('Webhook receive endpoint called', { 
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      ua: request.headers.get('user-agent') || 'unknown' 
    });
    logger.debug('Raw webhook request payload:', JSON.stringify(data));
    
    const alert = validateWebhookAlert(data);

    // Log the incoming request for debugging
    logger.debug('Validated webhook alert:', {
      botId: alert.bot_id,
      botIdType: typeof alert.bot_id,
      botIdLength: alert.bot_id.length,
      symbol: alert.symbol,
      action: alert.action
    });

    // Initialize Supabase clients
    const supabase = await createClient(request);
    const serviceClient = createServiceClient();

    // Try exact match first
    logger.debug('Trying exact match with ID:', JSON.stringify(alert.bot_id));
    let { data: bot, error } = await serviceClient
      .from('bots')
      .select('id, exchange, name, webhook_secret, user_id')
      .eq('id', alert.bot_id)
      .single();
      
    if (error || !bot) {
      // Try with trimmed ID
      const trimmedId = alert.bot_id.trim();
      logger.debug('Trying with trimmed ID:', JSON.stringify(trimmedId));
      
      ({ data: bot, error } = await serviceClient
        .from('bots')
        .select('id, exchange, name, webhook_secret, user_id')
        .eq('id', trimmedId)
        .single());
        
      if (error || !bot) {
        // Try case insensitive as last resort
        logger.debug('Trying case-insensitive match as last resort');
        ({ data: bot, error } = await serviceClient
          .from('bots')
          .select('id, exchange, name, webhook_secret, user_id')
          .ilike('id', alert.bot_id)
          .single());
      }
    }

    if (error || !bot) {
      logger.warn('Bot not found with ID:', alert.bot_id);
      throw new ApiError('Bot not found', 404);
    }

    logger.info('Bot found:', {
      id: bot.id,
      name: bot.name,
      exchange: bot.exchange
    });

    // Verify webhook secret
    logger.debug('Verifying webhook secret');
    logger.debug('- Received:', data.secret ? `${data.secret.substring(0, 8)}...` : 'none');
    logger.debug('- Expected:', bot.webhook_secret ? `${bot.webhook_secret.substring(0, 8)}...` : 'none');
    
    if (data.secret !== bot.webhook_secret) {
      logger.warn('Invalid webhook secret provided');
      throw new ApiError('Invalid webhook secret', 401);
    }
    logger.debug('Secret verified');

    // Generate a signal ID
    const signalId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.debug('Generated signal ID:', signalId);
    
    // Store signal in queue table (without user_id)
    const { error: queueError } = await serviceClient
      .from('signal_queue')
      .insert({
        id: signalId,
        bot_id: bot.id,
        payload: alert,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (queueError) {
      logger.error('Failed to queue signal:', queueError);
      throw new ApiError('Failed to queue signal', 500);
    }
    logger.info('Signal queued successfully', { signalId, botId: bot.id });

    // Quick response after validation
    return successResponse({
      signal_id: signalId,
      status: 'pending',
      bot: {
        id: bot.id,
        name: bot.name,
        exchange: bot.exchange
      },
      validationTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('Failed to validate webhook', error);
    return handleApiError(error);
  }
  */
} 