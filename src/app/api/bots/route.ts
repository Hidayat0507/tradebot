import { NextRequest } from 'next/server'
import { supabase } from '@/lib/database/client'
import { createServerClient } from '@supabase/ssr';
import { encrypt } from '@/utils/encryption';
import { randomBytes } from 'crypto';
import type { Database } from '@/lib/database/schema'
import {
  getAuthenticatedUser,
  validateBotData,
  handleApiError,
  successResponse,
  ApiError
} from '@/app/api/_middleware/api-handler';
import { logger } from '@/lib/logging';

type BotInsert = Database['public']['Tables']['bots']['Insert']

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);

    const { data: bots, error } = await supabase
      .from('bots')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Failed to fetch bots', { error, userId: user.id });
      throw new ApiError('Failed to fetch bots', 500);
    }

    return successResponse(bots);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    const payload = await request.json()

    validateBotData(payload);

    // Generate webhook secret
    const webhookSecret = randomBytes(32).toString('hex')

    // Encrypt API secret if provided, or use empty string
    let apiSecret = '';
    if (payload.api_secret) {
      apiSecret = await encrypt(payload.api_secret);
    }

    const botData: BotInsert = {
      user_id: user.id,
      name: payload.name,
      exchange: payload.exchange,
      pair: payload.pair,
      max_position_size: payload.max_position_size || 0.01,
      stoploss_percentage: payload.stoploss_percentage,
      enabled: payload.enabled || false,
      api_key: payload.api_key || '',
      api_secret: apiSecret,
      webhook_secret: webhookSecret,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: bot, error } = await supabase
      .from('bots')
      .insert(botData)
      .select()
      .single()

    if (error) {
      logger.error('Failed to create bot', { error, userId: user.id });
      throw new ApiError('Failed to create bot', 500);
    }

    logger.info('Bot created successfully', { botId: bot.id, userId: user.id });
    return successResponse(bot, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
