import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Protected routes that require authentication
const protectedRoutes = ['/bots', '/settings', '/dashboard']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Create Supabase client with production-ready cookie settings
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Ensure cookies work on Netlify by setting proper domain and secure options
          response.cookies.set({
            name,
            value,
            ...options,
            // In production (Netlify), ensure secure cookie settings
            ...(process.env.NODE_ENV === 'production' && {
              secure: true,
              sameSite: 'lax',
              domain: request.nextUrl.hostname,
              path: '/',
            })
          })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: '',
            ...options,
            expires: new Date(0),
            // In production (Netlify), ensure secure cookie settings
            ...(process.env.NODE_ENV === 'production' && {
              secure: true,
              sameSite: 'lax',
              domain: request.nextUrl.hostname,
              path: '/',
            })
          })
        },
      },
    }
  )

  try {
    // For protected routes, verify authentication using getUser
    if (protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        return NextResponse.redirect(new URL('/auth', request.url))
      }
    }

    // Update session
    await supabase.auth.getSession()
    return response
  } catch (error) {
    console.error('Middleware error:', error)
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
