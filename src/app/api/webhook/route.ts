import { NextRequest } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
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
    // Parse and validate the alert (avoid logging raw payload)
    const data = await request.json();
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

    // Minimal log before database query
    logger.debug('Querying database for bot');
    
    // Try exact match first
    // Single trimmed-ID lookup to reduce latency
    const trimmedId = alert.bot_id.trim();
    const { data: bot, error } = await serviceClient
      .from('bots')
      .select('id, exchange, api_key, api_secret, password, enabled, user_id, webhook_secret, name, max_position_size')
      .eq('id', trimmedId)
      .single();
    

    if (error || !bot) {
      // Minimal log of not found (avoid echoing attacker-provided identifiers)
      logger.warn('Bot not found');
      throw new ApiError('Bot not found', 404);
    }

    logger.info('Bot found for webhook', { id: bot.id, name: bot.name, exchange: bot.exchange });

    // Enforce enabled flag
    if ((bot as any).enabled === false) {
      logger.warn('Bot is disabled; rejecting webhook', { botId: bot.id });
      throw new ApiError('Bot is disabled', 403);
    }

    // Verify webhook secret
    // Verify webhook secret (supports hashed-at-rest with 'sha256:' prefix)
    const provided = String((data as any).secret || '');
    const stored = String(bot.webhook_secret || '');
    let validSecret = false;
    try {
      if (stored.startsWith('sha256:')) {
        const storedHex = stored.slice(7);
        const providedHash = createHash('sha256').update(provided).digest('hex');
        const a = Buffer.from(providedHash, 'hex');
        const b = Buffer.from(storedHex, 'hex');
        validSecret = a.length === b.length && timingSafeEqual(a, b);
      } else {
        const a = createHash('sha256').update(provided).digest();
        const b = createHash('sha256').update(stored).digest();
        validSecret = a.length === b.length && timingSafeEqual(a, b);
      }
    } catch {
      validSecret = false;
    }
    if (!validSecret) {
      logger.warn('Invalid webhook secret');
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
    
