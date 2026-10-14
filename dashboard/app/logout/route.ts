import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { AUTH_COOKIE_OPTIONS } from '@/lib/authCookies'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
  const redirect = NextResponse.redirect(new URL('/login', request.url))

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          redirect.cookies.set(name, value, options)
        }
      },
    },
  })

  await supabase.auth.signOut()

  return redirect
}
