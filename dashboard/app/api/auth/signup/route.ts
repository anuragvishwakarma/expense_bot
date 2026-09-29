import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createHash, randomBytes } from 'crypto'

// TEMP DEBUG - fingerprint for comparing log lines by equality without
// printing raw client IPs. Salted per-process and never logged itself,
// since IPv4 space (~4B) is small enough that an unsalted hash is a
// rainbow-table lookup, not real anonymization.
const debugSalt = randomBytes(16).toString('hex')
const fingerprint = (value: string) => createHash('sha256').update(debugSalt).update(value).digest('hex').slice(0, 8)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const CONFIRM_MESSAGE = 'Account created. Check your email to confirm before signing in.'

const MAX_SIGNUPS = 5
const WINDOW_MS = 60 * 60 * 1000
const MAX_TRACKED = 10_000

// ponytail: in-memory, per-instance rate limit - same tradeoff as
// /api/link-telegram. Resets on redeploy/cold start, doesn't share state
// across instances. Move to a DB-backed counter if this ever runs
// multi-instance or abuse shows up.
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  // ponytail: sweep expired entries only once the map gets big, not every
  // call - keeps this O(1) in the common case while still bounding memory
  // against an attacker cycling spoofed keys forever.
  if (attempts.size > MAX_TRACKED) {
    for (const [k, v] of attempts) {
      if (now > v.resetAt) attempts.delete(k)
    }
  }
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
    // Railway's edge replaces any client-supplied X-Forwarded-For (a forged
    // value never shows up) and appends its own node address on the right,
    // which differs per request. Leftmost entry is the real client; the
    // rightmost would give every request a fresh bucket.
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor?.split(',').map((part) => part.trim()).find(Boolean) || 'unknown'
    // TEMP DEBUG - remove once leftmost-is-client is confirmed in prod.
    const xffParts = forwardedFor ? forwardedFor.split(',').map((p) => fingerprint(p.trim())) : null
    const realIp = request.headers.get('x-real-ip')
    console.log(`[signup-debug] pid=${process.pid} ipFp=${fingerprint(ip)} realIpFp=${realIp ? fingerprint(realIp) : null} xffPartCount=${xffParts?.length ?? 0} xffFps=${JSON.stringify(xffParts)} mapSize=${attempts.size} entry=${JSON.stringify(attempts.get(ip))}`)
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

    // Fixed, server-configured origin only - never derived from the
    // request's Host header (request.nextUrl.origin), which a caller can
    // set to anything and would otherwise land directly in the
    // confirmation email as the redirect target.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (!siteUrl) {
      throw new Error('NEXT_PUBLIC_SITE_URL must be set')
    }

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
