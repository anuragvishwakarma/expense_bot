import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const CONFIRM_MESSAGE = 'Account created. Check your email to confirm before signing in.'

const MAX_SIGNUPS = 5
const WINDOW_MS = 60 * 60 * 1000

// ponytail: in-memory, per-instance rate limit - same tradeoff as
// /api/link-telegram. Resets on redeploy/cold start, doesn't share state
// across instances. Move to a DB-backed counter if this ever runs
// multi-instance or abuse shows up.
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_SIGNUPS
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Try again later.' },
        { status: 429 }
      )
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    })

    // Fixed, server-configured origin - never derived from the request's
    // Host header, which a caller can set to anything and would otherwise
    // land directly in the confirmation email as the redirect target.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/login`,
      },
    })

    if (error) {
      // Supabase's own message for a duplicate email would let a caller
      // enumerate which addresses already have accounts. Respond exactly
      // like a fresh signup instead; every other error (bad format, weak
      // password, rate limit) doesn't leak account existence, so pass it
      // through as-is.
      if (error.status === 422 || /already registered/i.test(error.message)) {
        return NextResponse.json({ message: CONFIRM_MESSAGE })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Project has email confirmation on, so signUp never returns a usable
    // session here - the account exists but can't sign in until confirmed.
    return NextResponse.json({
      message: data.session ? 'Account created' : CONFIRM_MESSAGE,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sign up failed' },
      { status: 500 }
    )
  }
}
