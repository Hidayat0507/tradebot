import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { decrypt } from '@/utils/encryption';
import { ExchangeError } from './exchange';
import type { Database, SupportedExchange } from '@/lib/database/schema';
import { getExchangePlugin } from '@/lib/exchanges/registry';
import type { ResolvedExchangeCredentials } from '@/lib/exchanges/types';

interface BotWithCredentials {
  exchange: SupportedExchange;
  api_key: string;
  api_secret?: string;
  password?: string;
}

type BotCredentialsRow = Pick<Database['public']['Tables']['bots']['Row'], 'exchange' | 'api_key' | 'api_secret' | 'password'>;

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
  fields: string[] = ['exchange', 'api_key', 'api_secret', 'password']
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

  try {
    getExchangePlugin(data.exchange as SupportedExchange);
  } catch (_pluginError) {
    throw new ExchangeError(`Invalid exchange type: ${data.exchange}`, 400);
  }

  // Ensure bot has the correct shape
  const botWithCreds: BotWithCredentials = {
    exchange: data.exchange as SupportedExchange, // Safe cast since we validated the value
    api_key: data.api_key,
    api_secret: data.api_secret,
    password: data.password
  };
  
  return botWithCreds;
}

/**
 * Create exchange client with proper configuration
 */
export async function createExchangeClientFromBot(bot: BotWithCredentials) {
  const plugin = getExchangePlugin(bot.exchange)
  const credentials: ResolvedExchangeCredentials = {
    apiKey: bot.api_key,
  }

  if (bot.api_secret) {
    credentials.apiSecret = await decrypt(bot.api_secret)
  }

  if ((bot as any).password) {
    credentials.password = await decrypt((bot as any).password)
  }

  return plugin.createClient(credentials)
}

/**
 * Standard error response handler
 */
export function handleExchangeError(error: unknown) {
  console.error('Exchange operation error:', error);
  
  const status = error instanceof ExchangeError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  
  return NextResponse.json({ error: message }, { status });
} 
