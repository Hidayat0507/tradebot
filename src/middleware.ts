import { rateLimiter, requestIp, rateLimitResponse } from '@/lib/rate-limit'
import { isAdminUser } from '@/lib/subscriptions'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Protected routes that require authentication
const protectedRoutes = [
  '/bots', 
  '/bots/create', 
  '/dashboard', 
  '/profile', '/admin', '/logs', '/billing', '/assets'
]

// Check if a route should bypass authentication
function shouldBypassAuth(pathname: string) {
  // List of API endpoints that don't require authentication
  const publicApiEndpoints = [
    '/api/bots/*/webhook-secret'  // Allow webhook secret regeneration
  ];

  return publicApiEndpoints.some(pattern => {
    // Convert pattern to regex, replacing * with wildcard matcher
    const regexPattern = pattern.replace(/\*/g, '[^/]+');
    return new RegExp(`^${regexPattern}$`).test(pathname);
  });
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith('/api/') && pathname !== '/api/webhook' && pathname !== '/api/stripe/webhook') {
    if (!await rateLimiter.consume(`auth:${requestIp(request)}`, 60, 60000)) return rateLimitResponse()
  }

  // Skip auth check for public API endpoints
  if (shouldBypassAuth(pathname)) {
    return response;
  }

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

  if (protectedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.redirect(new URL('/auth', request.url))
    if ((pathname === '/admin' || pathname.startsWith('/admin/')) && !isAdminUser(user)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
