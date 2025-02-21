import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}

// Protected routes that require authentication
const protectedRoutes = ['/bots', '/settings', '/dashboard']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const requestPath = request.nextUrl.pathname

  try {
    // Create a Supabase client configured to use cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    // Try to get the session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Check if route requires auth
    const isProtectedRoute = protectedRoutes.some(route => requestPath.startsWith(route))
    const isAuthPage = requestPath.startsWith('/auth')

    // If no session and trying to access protected route, redirect to auth
    if (!session && isProtectedRoute) {
      return NextResponse.redirect(new URL('/auth', request.url))
    }

    // If has session and on auth page, redirect to dashboard
    if (session && isAuthPage) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return response
  } catch (e) {
    // On error, redirect to auth for protected routes
    console.error('Auth middleware error:', e)
    if (protectedRoutes.some(route => requestPath.startsWith(route))) {
      return NextResponse.redirect(new URL('/auth', request.url))
    }
    return response
  }
}
