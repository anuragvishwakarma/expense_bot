import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createRateLimiter, clientIp } from '@/lib/rateLimit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Same answer whether or not the address has an account, so this cannot be used to find out who signed up
const GENERIC = 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.'

const byIp = createRateLimiter(10, 60 * 60 * 1000)
const byEmail = createRateLimiter(3, 60 * 60 * 1000)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || email.length > 254 || !EMAIL.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  // Rate-limited requests still get the normal answer; they just send nothing
  if (byIp(clientIp(request.headers)) || byEmail(email)) {
    return NextResponse.json({ message: GENERIC })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    console.error('NEXT_PUBLIC_SITE_URL must be set for password reset')
    return NextResponse.json({ error: 'Password reset is not available right now.' }, { status: 500 })
  }

  // The PKCE code verifier is stored in a cookie; carry it onto the response
  const cookieCarrier = new NextResponse()
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) cookieCarrier.cookies.set(name, value, options)
      },
    },
  })

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  })
  if (error) console.error('resetPasswordForEmail failed:', error.message)

  return NextResponse.json({ message: GENERIC }, { headers: cookieCarrier.headers })
}
