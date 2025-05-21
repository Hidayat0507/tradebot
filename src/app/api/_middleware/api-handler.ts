import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { Database } from '@/lib/database/schema';
import { logger } from '@/lib/logging';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Validate required fields and optional custom validations
 */
export function validateFields(
  data: any, 
  requiredFields: string[], 
  customValidators?: Record<string, (value: any) => boolean | string>
) {
  // Check for required fields
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      throw new ApiError(`Missing required field: ${field}`, 400);
    }
  }
  
  // Run custom validators if provided
  if (customValidators) {
    for (const [field, validator] of Object.entries(customValidators)) {
      if (data[field] !== undefined) {
        const result = validator(data[field]);
        if (result !== true) {
          const errorMessage = typeof result === 'string' 
            ? result 
            : `Invalid value for field: ${field}`;
          throw new ApiError(errorMessage, 400);
        }
      }
    }
  }
  
  return true;
}

/**
 * Get authenticated user and Supabase client
 */
export async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new ApiError('Unauthorized', 401);
  }
  
  return { user, supabase };
}

/**
 * Get resource with ownership check
 */
export async function getResourceWithOwnership(
  request: NextRequest,
  table: string,
  id: string,
  fields: string = '*'
) {
  const { user, supabase } = await getAuthenticatedUser(request);
  
  const { data, error } = await supabase
    .from(table)
    .select(fields)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  
  if (error || !data) {
    const resourceName = table.charAt(0).toUpperCase() + table.slice(1, -1); // Convert 'bots' to 'Bot'
    throw new ApiError(`${resourceName} not found`, 404);
  }
  
  return { resource: data, user, supabase };
}

/**
 * Get bot with ownership check
 */
export async function getBotWithOwnership(
  request: NextRequest,
  botId: string,
  fields: string = '*'
) {
  const { resource: bot, user, supabase } = await getResourceWithOwnership(
    request, 
    'bots', 
    botId, 
    fields
  );
  
  return { bot, user, supabase };
}

/**
 * Validate bot data
 */
export function validateBotData(data: any) {
  validateFields(
    data,
    ['name', 'exchange', 'pair'],
    {
      exchange: (value) => 
        ['binance', 'hyperliquid', 'bitget'].includes(value) || 
        'Invalid exchange. Must be binance, hyperliquid, or bitget'
    }
  );
}

/**
 * Standard success response
 */
export function successResponse(data: any = null, status: number = 200) {
  return NextResponse.json({
    success: true,
    data
  }, { status });
}

/**
 * Standard error response handler
 */
export function handleApiError(error: any) {
  logger.error('API operation error', { 
    error: error instanceof Error ? error.message : error,
    statusCode: error instanceof ApiError ? error.statusCode : 500
  });
  
  const status = error instanceof ApiError ? error.statusCode : 500;
  const message = error.message || 'An unexpected error occurred';
  
  return NextResponse.json({
    success: false,
    error: message,
    data: error instanceof ApiError ? error.data : undefined
  }, { status });
} 