import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, parse } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const publicRoutes = ['/login']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  try {
    // Parse cookies from request
    const cookies = parse(request.headers.get('cookie') ?? '')

    // Create Supabase server client to validate session
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return Object.entries(cookies).map(([name, value]) => ({ name, value }))
        },
        setAll(cookiesToSet: any) {
          // Cookies are set in response below if needed
        },
      },
    })

    // Verify session is valid - this checks JWT signature against Supabase public key
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      // Session invalid or expired, redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('sb-access-token')
      response.cookies.delete('sb-refresh-token')
      return response
    }

    // Session valid, continue with user info in headers
    const response = NextResponse.next()
    response.headers.set('x-user-id', user.id)

    return response
  } catch (error) {
    // Any error validating session, redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('sb-access-token')
    response.cookies.delete('sb-refresh-token')
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
}
