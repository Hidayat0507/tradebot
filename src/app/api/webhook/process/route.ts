import { NextRequest } from 'next/server';
import { ApiError } from '@/app/api/_middleware/api-handler';
import { 
  handleApiError,
  successResponse
} from '@/app/api/_middleware/api-handler';
import { processWebhookAlert } from '@/app/api/_middleware/webhook';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logging';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { signal_id } = data;
    
    if (!signal_id) {
      throw new ApiError('Missing signal_id parameter', 400);
    }
    
    logger.info('Processing webhook signal', { signal_id });
    
    // Initialize Supabase clients
    const supabase = await createClient(request);
    const serviceClient = createServiceClient();
    
    // Get signal from queue
    const { data: signal, error: signalError } = await serviceClient
      .from('signal_queue')
      .select('*')
      .eq('id', signal_id)
      .single();
      
    if (signalError || !signal) {
      logger.error('Signal not found', { signal_id, error: signalError });
      throw new ApiError('Signal not found', 404);
    }
    
    // Check if already processed
    if (signal.status === 'completed') {
      logger.info('Signal already processed', { signal_id });
      return successResponse({
        signal_id,
        status: 'processed',
        result: signal.result
      });
    }
    
    // Check if already failed
    if (signal.status === 'failed') {
      logger.info('Signal previously failed', { signal_id, error: signal.error });
      throw new ApiError(`Signal processing previously failed: ${signal.error}`, 500);
    }
    
    // Update status to processing
    const { error: updateError } = await serviceClient
      .from('signal_queue')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', signal_id);
      
    if (updateError) {
      logger.error('Failed to update signal status', { signal_id, error: updateError });
      throw new ApiError('Failed to update signal status', 500);
    }
    
    logger.info('Signal status updated to processing', { signal_id });
    
    try {
      // Get the full bot details needed for processing
      const { data: bot, error: botError } = await serviceClient
        .from('bots')
        .select('id, exchange, api_key, api_secret, user_id, webhook_secret, name')
        .eq('id', signal.bot_id)
        .single();
        
      if (botError || !bot) {
        throw new Error(`Bot not found: ${botError?.message || 'Unknown error'}`);
      }
      
      logger.info('Processing signal for bot', { 
        signal_id, 
        botId: bot.id,
        symbol: signal.payload.symbol,
        action: signal.payload.action
      });
      
      // Add default order_size to the bot object
      const botWithOrderSize = {
        ...bot,
        order_size: 100 // Default to 100%
      };
      
      // Process the webhook alert
      const trade = await processWebhookAlert(signal.payload, botWithOrderSize, serviceClient);
      
      // Update signal as completed
      const result = {
        trade,
        botId: bot.id,
        symbol: signal.payload.symbol,
        action: signal.payload.action,
        processedAt: new Date().toISOString()
      };
      
      const { error: completeError } = await serviceClient
        .from('signal_queue')
        .update({
          status: 'completed',
          result,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .eq('id', signal_id);
      
      if (completeError) {
        logger.error('Failed to update signal as completed', { signal_id, error: completeError });
      } else {
        logger.info('Signal processed successfully', { signal_id, botId: bot.id });
      }
      
      return successResponse({
        signal_id,
        status: 'processed',
        result
      });
      
    } catch (processingError) {
      // Update signal as failed
      const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
      logger.error('Signal processing failed', { signal_id, error: errorMessage });
      
      await serviceClient
        .from('signal_queue')
        .update({
          status: 'failed',
          error: errorMessage,
          updated_at: new Date().toISOString(),
          failed_at: new Date().toISOString()
        })
        .eq('id', signal_id);
      
      throw new ApiError(`Processing failed: ${errorMessage}`, 500);
    }
    
  } catch (error) {
    logger.error('Error in process endpoint', { error });
    return handleApiError(error);
  }
} 