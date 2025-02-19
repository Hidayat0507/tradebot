import { NextResponse } from 'next/server';
import { logger } from '@/lib/logging';

export interface ApiError extends Error {
  statusCode?: number;
  help?: string;
}

export function handleApiError(error: unknown, context: Record<string, any> = {}) {
  const apiError = error as ApiError;
  
  // Log the error with context
  logger.error(apiError.message || 'Unknown error', apiError, context);

  // Default to 500 if no status code is set
  const statusCode = apiError.statusCode || 500;
  
  // Prepare the error response
  const errorResponse: Record<string, any> = {
    error: apiError.message || 'Internal server error'
  };

  // Add help text if available
  if (apiError.help) {
    errorResponse.help = apiError.help;
  }

  return NextResponse.json(errorResponse, { status: statusCode });
}
