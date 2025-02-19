import { createServerClient, type CookieOptions } from '@supabase/ssr'
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
        async set(name: string, value: string, options: CookieOptions) {
          await cookieStore.set(name, value, options)
        },
        async remove(name: string, options: CookieOptions) {
          await cookieStore.delete({
            name,
            ...options
          })
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
