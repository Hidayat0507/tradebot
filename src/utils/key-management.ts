import { decrypt } from '@/utils/encryption'
import { createClient } from '@/utils/supabase/server'
import { NextRequest } from 'next/server'
import type { SupportedExchange } from '@/lib/database/schema'

interface ExchangeCredentials {
  apiKey: string
  apiSecret: string
  exchange?: SupportedExchange
}

/**
 * Get bot credentials from database with security check
 */
export async function getBotCredentials(
  request: NextRequest,
  botId: string
): Promise<ExchangeCredentials> {
  const supabase = await createClient(request)
  
  // Get the bot's user ID for security check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new Error('Unauthorized')
  }
  
  // Get the bot with security check (user_id match)
  const { data: bot, error } = await supabase
    .from('bots')
    .select('exchange, api_key, api_secret')
    .eq('id', botId)
    .eq('user_id', user.id)
    .single()
  
  if (error || !bot) {
    throw new Error(`Bot not found or access denied: ${error?.message || 'Unknown error'}`)
  }

  // Validate required credentials based on exchange
  if (!bot.api_key) {
    throw new Error('Bot is missing API key')
  }

  // For non-Hyperliquid exchanges, we need both key and secret
  if (bot.exchange !== 'hyperliquid' && !bot.api_secret) {
    throw new Error('Bot is missing API secret')
  }

  // Decrypt the API secret if it exists
  const apiSecret = bot.api_secret ? await decrypt(bot.api_secret) : '';

  return {
    apiKey: bot.api_key,
    apiSecret,
    exchange: bot.exchange as SupportedExchange
  }
}

/** Resolve only authenticated, bot-owned credentials. */
export async function getExchangeCredentials(
  request: NextRequest,
  exchange: SupportedExchange,
  botId?: string
): Promise<ExchangeCredentials> {
  if (!botId) throw new Error('Bot ID is required for exchange credentials')
  const credentials = await getBotCredentials(request, botId)
  if (credentials.exchange !== exchange) throw new Error('Bot exchange mismatch')
  return credentials
}
