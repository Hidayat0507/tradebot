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
 * Get credential from environment variable
 */
function getEnvCredential(exchange: SupportedExchange, type: 'key' | 'secret'): string | null {
  const exchangeUpper = exchange.toUpperCase()
  const typeUpper = type.toUpperCase()
  
  // Check for exchange-specific env var (e.g., BINANCE_API_KEY)
  const specificVar = process.env[`${exchangeUpper}_API_${typeUpper}`]
  if (specificVar) {
    return specificVar
  }
  
  // Check for generic env var (e.g., API_KEY)
  const genericVar = process.env[`API_${typeUpper}`]
  if (genericVar) {
    return genericVar
  }
  
  return null
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

/**
 * Get exchange credentials from environment variables or database
 * Priority: 
 * 1. Environment variables (if available)
 * 2. Bot-specific credentials from database
 */
export async function getExchangeCredentials(
  request: NextRequest,
  exchange: SupportedExchange,
  botId?: string
): Promise<ExchangeCredentials> {
  // First try to get from environment variables
  const envApiKey = getEnvCredential(exchange, 'key')
  const envApiSecret = getEnvCredential(exchange, 'secret')
  
  // If both environment variables are available, use them
  if (envApiKey && envApiSecret) {
    return {
      apiKey: envApiKey,
      apiSecret: envApiSecret,
      exchange
    }
  }
  
  // If no botId provided, return what we have from env (may be incomplete)
  if (!botId) {
    return {
      apiKey: envApiKey || '',
      apiSecret: envApiSecret || '',
      exchange
    }
  }
  
  // If botId is provided, get from database with security check
  return getBotCredentials(request, botId)
}
