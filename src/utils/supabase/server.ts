import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function createClient(request: NextRequest) {
  const cookieStore = request.cookies

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, _options: CookieOptions) {
          cookieStore.delete(name)
        },
      },
    }
  )

  return supabase
}

/**
 * Create a service role client that can bypass RLS policies
 * Use only on the server. User-initiated writes must authenticate and verify
 * ownership before using this client, and explicitly filter by the owner.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
