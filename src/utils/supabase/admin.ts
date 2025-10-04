import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database/schema'

/**
 * Create Supabase admin client with service role key
 * This client bypasses RLS and has full admin privileges
 * Use ONLY in server-side code for admin operations
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase URL or Service Role Key')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

