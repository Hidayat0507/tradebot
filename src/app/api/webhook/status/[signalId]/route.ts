import { NextRequest } from 'next/server';
import { ApiError } from '@/app/api/_middleware/api-handler';
import { 
  handleApiError,
  successResponse
} from '@/app/api/_middleware/api-handler';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logging';

export async function GET(
  request: NextRequest,
  { params }: { params: { signalId: string } }
) {
  // TEMPORARILY DISABLED: Queue-based webhook system is not in use currently.
  // All webhook processing is being handled by the original /api/webhook endpoint.
  // To re-enable, uncomment the code below and remove this return statement.
  return successResponse({
    status: 'error',
    message: 'This endpoint is temporarily disabled. Please use /api/webhook endpoint instead.',
    disabled: true
  });

  /* Original implementation:
  try {
    const { signalId } = params;
    
    if (!signalId) {
      throw new ApiError('Missing signal ID', 400);
    }
    
    logger.info('Checking signal status', { signalId });
    
    // Initialize Supabase clients
    const supabase = await createClient(request);
    const serviceClient = createServiceClient();
    
    // Get signal from queue
    const { data: signal, error: signalError } = await serviceClient
      .from('signal_queue')
      .select('*')
      .eq('id', signalId)
      .single();
      
    if (signalError || !signal) {
      logger.error('Signal not found', { signalId, error: signalError });
      throw new ApiError('Signal not found', 404);
    }
    
    logger.debug('Retrieved signal data', { signalId, status: signal.status });
    
    // Return signal data (omit internal fields)
    return successResponse({
      signal_id: signal.id,
      status: signal.status,
      bot_id: signal.bot_id,
      payload: signal.payload,
      result: signal.result,
      error: signal.error,
      created_at: signal.created_at,
      updated_at: signal.updated_at,
      processing_started_at: signal.processing_started_at,
      completed_at: signal.completed_at,
      failed_at: signal.failed_at
    });
    
  } catch (error) {
    logger.error('Error checking signal status', { error });
    return handleApiError(error);
  }
  */
} 