import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Protected routes that require authentication
const protectedRoutes = [
  '/bots', 
  '/bots/create', 
  '/dashboard', 
  '/profile'
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
    return new RegExp(regexPattern).test(pathname);
  });
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

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

  // Check auth for protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      );
    }
    
    // Try to refresh the session if no active session
    if (!session) {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError || !refreshedSession) {
        // For API routes, return JSON response
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          );
        }
        // For other routes, redirect to auth page
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
