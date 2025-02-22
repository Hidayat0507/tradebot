import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Protected routes that require authentication
const protectedRoutes = ['/bots', '/bots/create', '/dashboard', '/profile']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
            secure: true,
            sameSite: 'lax',
          })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: '',
            ...options,
            expires: new Date(0),
          })
        },
      },
    }
  )

  // Check auth for protected routes
  if (protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // Try to refresh the session if no active session
    if (!session) {
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession()
      if (!refreshedSession) {
        return NextResponse.redirect(new URL('/auth', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
