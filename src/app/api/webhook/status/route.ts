import { NextRequest } from 'next/server';
import { successResponse } from '@/app/api/_middleware/api-handler';
import { createClient } from '@/utils/supabase/server';

/**
 * Status endpoint to check if the webhook API is operational
 */
export async function GET(request: NextRequest) {
  // Initialize Supabase client
  const supabase = await createClient(request);
  
  // Get user session if available
  const session = await supabase.auth.getSession();
  const isAuthenticated = !!session?.data?.session;

  return successResponse({
    status: 'operational',
    authenticated: isAuthenticated,
    server_time: new Date().toISOString()
  });
} 