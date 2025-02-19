import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/bots/:path*'
  ]
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({
              name,
              value,
              path: '/',
              ...options,
            })
            response.cookies.set({
              name,
              value,
              path: '/',
              ...options,
            })
          },
          remove(name: string, options: any) {
            request.cookies.delete({
              name,
              path: '/',
              ...options,
            })
            response.cookies.delete({
              name,
              path: '/',
              ...options,
            })
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.redirect(new URL('/auth', request.url))
    }

    return response
  } catch (e) {
    console.error('Auth middleware error:', e)
    return NextResponse.redirect(new URL('/auth', request.url))
  }
}
