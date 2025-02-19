import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Set cookie for the request - using the correct tuple format
          request.cookies.set(name, value)
          
          // Create new response with updated request headers
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          
          // Set cookie for the response
          response.cookies.set(name, value, options)
        },
        remove(name: string, options: CookieOptions) {
          // Remove cookie from request
          request.cookies.delete(name)
          
          // Create new response with updated request headers
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          
          // Remove cookie from response
          response.cookies.delete(name)
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  // Get the current path
  const path = request.nextUrl.pathname

  // Define public routes that don't require authentication
  const isPublicRoute = 
    path.startsWith('/_next') || // Next.js resources
    path.startsWith('/api/') ||  // API routes
    path === '/auth' ||         // Auth page
    path.startsWith('/auth/') || // Auth-related routes
    path === '/'               // Home page

  // If user is signed in and tries to access /auth, redirect to /dashboard
  if (user && path === '/auth') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Allow public routes
  if (isPublicRoute) {
    return response
  }

  // If no session and trying to access protected route, redirect to /auth
  if (!user) {
    const redirectUrl = new URL('/auth', request.url)
    // Store the original URL to redirect back after auth
    redirectUrl.searchParams.set('redirectedFrom', path)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}
