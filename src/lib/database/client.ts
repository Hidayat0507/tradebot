import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './schema'

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

const REQUIRED_ENV_VARS = {
  NEXT_PUBLIC_SUPABASE_URL: 'Required for database connection',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Required for database authentication',
} as const

function validateEnvironment(): void {
  const missingVars = Object.entries(REQUIRED_ENV_VARS)
    .filter(([key]) => !process.env[key])
    .map(([key, description]) => `${key}: ${description}`)

  if (missingVars.length > 0) {
    throw new ConfigError(
      `Missing required environment variables:\n${missingVars.join('\n')}`
    )
  }
}

// Only validate on server-side
if (typeof window === 'undefined') {
  validateEnvironment()
}

export function createClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Export a singleton instance for use in operations
export const supabase: SupabaseClient<Database> = createClient()
