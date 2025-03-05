import { NextRequest } from 'next/server';
import { successResponse } from '@/app/api/_middleware/api-handler';
import { logger } from '@/lib/logging';

// Get simulation mode from environment variable
const SIMULATION_MODE = process.env.SIMULATION_MODE === 'true';

/**
 * Status endpoint to check if simulation mode is enabled
 */
export async function GET(request: NextRequest) {
  logger.info('Status check requested');
  
  return successResponse({
    status: 'ok',
    simulation_mode: SIMULATION_MODE,
    server_time: new Date().toISOString()
  });
} 