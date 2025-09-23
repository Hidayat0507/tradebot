import { createClient } from '@/utils/supabase/server'
import { encrypt } from '@/utils/encryption'
import type { SupportedExchange } from '@/lib/database/schema'
import type { NextRequest } from 'next/server'
import { getExchangePlugin } from '@/lib/exchanges/registry'
import type { ResolvedExchangeCredentials } from '@/lib/exchanges/types'

export class ExchangeError extends Error {
  constructor(message: string, public statusCode: number = 500, public help?: string) {
    super(message)
    this.name = 'ExchangeError'
  }
}

function mapToExchangeError(error: unknown): ExchangeError {
  if (error instanceof ExchangeError) {
    return error
  }

  if (error instanceof Error) {
    return new ExchangeError(error.message)
  }

  return new ExchangeError('Unknown exchange error')
}

function buildResolvedCredentials(
  pluginId: SupportedExchange,
  apiKey: string,
  apiSecret?: string,
  password?: string
): ResolvedExchangeCredentials {
  const credentials: ResolvedExchangeCredentials = {
    apiKey,
  }

  if (apiSecret) {
    credentials.apiSecret = apiSecret
  }
  if (password) {
    credentials.password = password
  }

  return credentials
}

export async function validateAndStoreCredentials(
  request: NextRequest,
  botId: string,
  apiKey: string,
  apiSecret: string,
  exchange: SupportedExchange,
  password?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const plugin = getExchangePlugin(exchange)

    const providedCreds: Record<string, string | undefined> = {
      apiKey,
      apiSecret,
      password,
    }

    const missing = plugin.requiredCredentials.filter((key) => !providedCreds[key])
    if (missing.length > 0) {
      const fieldLabel = missing.join(', ')
      throw new ExchangeError(`Missing required credential(s): ${fieldLabel}`, 400)
    }

    const resolved = buildResolvedCredentials(exchange, apiKey, apiSecret, password)
    const client = await plugin.createClient(resolved, 'credential_validation')

    await client.loadMarkets()

    const balanceParams = plugin.getBalanceParams?.(resolved, { context: 'credential_validation' })
    await client.fetchBalance(balanceParams)

    let encryptedSecret: string | null = null
    if (apiSecret) {
      try {
        encryptedSecret = await encrypt(apiSecret)
      } catch {
        throw new ExchangeError('Failed to encrypt API credentials', 500)
      }
    }

    let encryptedPassword: string | null = null
    if (password) {
      try {
        encryptedPassword = await encrypt(password)
      } catch {
        throw new ExchangeError('Failed to encrypt API credentials', 500)
      }
    }

    const supabase = await createClient(request)
    const { error } = await supabase
      .from('bots')
      .update({
        api_key: apiKey,
        api_secret: encryptedSecret,
        ...(encryptedPassword ? { password: encryptedPassword } : {}),
      } as any)
      .eq('id', botId)

    if (error) {
      throw new ExchangeError(`Failed to store exchange credentials: ${error.message}`, 500)
    }

    return { success: true, message: 'API validated successfully' }
  } catch (error) {
    throw mapToExchangeError(error)
  }
}
