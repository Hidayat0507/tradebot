import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getSession() {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore.get(name)
          return cookie?.value
        },
        // READ-ONLY: set and remove are no-ops to prevent Next.js cookie modification errors in Server Components
        async set() {
          // Cannot modify cookies in Server Components - no-op
        },
        async remove() {
          // Cannot modify cookies in Server Components - no-op
        },
      },
    }
  )

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session
  } catch (error) {
    console.error('Error:', error)
    return null
  }
}

export async function getUserId() {
  const session = await getSession()
  return session?.user?.id
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    throw new Error('Authentication required')
  }
  return session
}
