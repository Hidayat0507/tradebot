import { createClient } from '@supabase/supabase-js';
import type { Database } from './schema';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const REQUIRED_ENV_VARS = {
  NEXT_PUBLIC_SUPABASE_URL: 'Required for database connection',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Required for database authentication',
} as const;

function validateEnvironment(): void {
  const missingVars = Object.entries(REQUIRED_ENV_VARS)
    .filter(([key]) => !process.env[key])
    .map(([key, description]) => `${key}: ${description}`);

  if (missingVars.length > 0) {
    throw new ConfigError(
      'Missing required environment variables:\n' + missingVars.join('\n')
    );
  }
}

if (typeof window === 'undefined') {
  validateEnvironment();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (typeof window === 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('Supabase environment variables missing. This is expected during build time.');
}

export const supabase = createClient<Database>(
  supabaseUrl || '',  // Provide fallback for build time
  supabaseAnonKey || '',  // Provide fallback for build time
  {
    auth: {
      persistSession: true, // Enable session persistence
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
