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

export function validateEnvironment(): void {
  const missingVars = Object.entries(REQUIRED_ENV_VARS)
    .filter(([key]) => !process.env[key])
    .map(([key, description]) => `${key}: ${description}`)

  if (missingVars.length > 0) {
    throw new ConfigError(
      `Missing required environment variables:\n${missingVars.join('\n')}`
    )
  }
}

export function createClient(): SupabaseClient<Database> {
  // Validate lazily at call (request) time so `next build` works without env.
  validateEnvironment()
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

let instance: SupabaseClient<Database> | null = null

/** Lazily-created singleton; throws ConfigError at request time if env is missing. */
export function getSupabase(): SupabaseClient<Database> {
  if (!instance) instance = createClient()
  return instance
}

/** @internal test helper */
export function __resetSupabaseForTests(): void {
  instance = null
}
