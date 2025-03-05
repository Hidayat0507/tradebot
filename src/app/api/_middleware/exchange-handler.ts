import { NextRequest, NextResponse } from 'next/server';
import * as ccxt from 'ccxt';
import { createClient } from '@/utils/supabase/server';
import { decrypt } from '@/utils/encryption';
import { ExchangeError } from './exchange';
import type { Database, SupportedExchange } from '@/lib/database/schema';
import type { SupabaseClient } from '@supabase/supabase-js';

interface BotWithCredentials {
  exchange: SupportedExchange;
  api_key: string;
  api_secret?: string;
}

type BotCredentialsRow = Pick<Database['public']['Tables']['bots']['Row'], 'exchange' | 'api_key' | 'api_secret'>;

/**
 * Get authenticated user from request
 */
export async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new ExchangeError('Unauthorized', 401);
  }
  
  return { user, supabase };
}

/**
 * Get bot with credentials
 */
export async function getBotWithCredentials(
  request: NextRequest,
  botId: string,
  fields: string[] = ['exchange', 'api_key', 'api_secret']
): Promise<BotWithCredentials> {
  const { user, supabase } = await getAuthenticatedUser(request);
  
  const { data, error } = await supabase
    .from('bots')
    .select<typeof fields[number], BotCredentialsRow>(fields.join(', '))
    .eq('id', botId)
    .eq('user_id', user.id)
    .single();
  
  if (error || !data) {
    throw new ExchangeError('Bot not found', 404);
  }

  // Type guard to ensure bot has required fields
  if (!data.exchange || !data.api_key) {
    throw new ExchangeError('Bot is missing required credentials', 400);
  }

  // Validate exchange type
  if (!['binance', 'hyperliquid'].includes(data.exchange)) {
    throw new ExchangeError(`Invalid exchange type: ${data.exchange}`, 400);
  }

  // Ensure bot has the correct shape
  const botWithCreds: BotWithCredentials = {
    exchange: data.exchange as SupportedExchange, // Safe cast since we validated the value
    api_key: data.api_key,
    api_secret: data.api_secret
  };
  
  return botWithCreds;
}

/**
 * Create exchange client with proper configuration
 */
export async function createExchangeClientFromBot(bot: BotWithCredentials) {
  if (!['binance', 'hyperliquid'].includes(bot.exchange)) {
    throw new ExchangeError(`Unsupported exchange: ${bot.exchange}`, 400);
  }

  const exchangeClass = bot.exchange === 'binance' ? ccxt.binance : ccxt.hyperliquid;
  const exchange = new exchangeClass({
    apiKey: bot.api_key,
    secret: bot.api_secret ? decrypt(bot.api_secret) : '',
    enableRateLimit: true
  });

  return exchange;
}

/**
 * Standard error response handler
 */
export function handleExchangeError(error: any) {
  console.error('Exchange operation error:', error);
  
  const status = error instanceof ExchangeError ? error.statusCode : 500;
  const message = error.message || 'An unexpected error occurred';
  
  return NextResponse.json({ error: message }, { status });
} 