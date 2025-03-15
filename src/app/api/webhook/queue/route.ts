import { NextRequest } from 'next/server';
import { ApiError } from '@/app/api/_middleware/api-handler';
import { 
  handleApiError,
  successResponse,
  getAuthenticatedUser
} from '@/app/api/_middleware/api-handler';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logging';

/**
 * Get status of the webhook queue (admin/user only)
 */
export async function GET(request: NextRequest) {
  try {
    // Only allow authenticated users to view the queue
    const { user, supabase } = await getAuthenticatedUser(request);
    const serviceClient = createServiceClient();
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const botId = searchParams.get('bot_id');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    // Build the query
    let query = serviceClient
      .from('signal_queue')
      .select('*, bots(id, name, exchange)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);
    
    // Add filters if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    if (botId) {
      query = query.eq('bot_id', botId);
    }
    
    // Execute query
    const { data: signals, error, count } = await query;
    
    if (error) {
      logger.error('Failed to fetch signals', { error, userId: user.id });
      throw new ApiError('Failed to fetch signals', 500);
    }
    
    // Try to get count of signals by status using the RPC function (preferred method)
    let statusCounts = null;
    try {
      const { data, error: countError } = await serviceClient
        .rpc('get_signal_counts_by_status', { user_id_param: user.id });
        
      if (countError) {
        throw countError;
      }
      statusCounts = data;
    } catch (rpcError) {
      // Fall back to separate queries for each status type if RPC fails
      logger.warn('Failed to use RPC for status counts, falling back to separate queries', { error: rpcError });
      
      // Alternative: Run separate count queries for each status type
      const statusOptions = ['pending', 'processing', 'completed', 'failed'];
      statusCounts = [];
      
      for (const statusOption of statusOptions) {
        const { data: countData, error: countError } = await serviceClient
          .from('signal_queue')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', statusOption);
          
        if (!countError) {
          statusCounts.push({
            status: statusOption,
            count: countData?.length || 0
          });
        } else {
          logger.error(`Failed to fetch count for status ${statusOption}`, { error: countError });
        }
      }
    }
    
    return successResponse({
      signals,
      total: count,
      status_counts: statusCounts || [],
      limit,
      offset
    });
    
  } catch (error) {
    logger.error('Error fetching webhook queue', { error });
    return handleApiError(error);
  }
} 