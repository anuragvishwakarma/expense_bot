import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// /reset-password checks the session itself so it can explain an expired link
const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/privacy', '/terms']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip middleware for public routes and static assets
  if (publicRoutes.includes(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  try {
    // response starts as a pass-through; setAll below replaces it with one
    // carrying any refreshed session cookies (mirrors Supabase's documented
    // Next.js middleware pattern so getUser()'s token refresh isn't dropped)
    let response = NextResponse.next({ request })

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
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
      const redirect = NextResponse.redirect(new URL('/login', request.url))
      for (const { name } of request.cookies.getAll()) {
        if (name.startsWith('sb-') && name.includes('auth-token')) {
          redirect.cookies.delete(name)
        }
      }
      return redirect
    }

    // Session valid, continue with user info in headers
    response.headers.set('x-user-id', user.id)

    return response
  } catch (error) {
    // Any error validating session, redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url))
    for (const { name } of request.cookies.getAll()) {
      if (name.startsWith('sb-') && name.includes('auth-token')) {
        response.cookies.delete(name)
      }
    }
    return response
  }
}

export const config = {
  matcher: [
    '/((?!_next|login|signup|forgot-password|reset-password|privacy|terms|auth/callback|favicon|static|public|api).*)',
  ],
}
