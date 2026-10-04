import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { clientIp } from '@/lib/rateLimit'
import { byPair, byIp, byEmail } from '@/lib/loginThrottle'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const TOO_MANY = 'Too many failed attempts. Please wait a few minutes and try again, or reset your password.'
// Only these Supabase messages are shown as they are; anything else becomes a generic failure
const SAFE_MESSAGES = new Set(['Invalid login credentials', 'Email not confirmed'])

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const ip = clientIp(request.headers)
  const pair = `${ip}|${email}`
  if (byPair.isBlocked(pair) || byIp.isBlocked(ip) || byEmail.isBlocked(email)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 })
  }

  try {
    // Cookie carrier: signInWithPassword's setAll writes here; the actual
    // JSON body is decided after we know the result, then copied on top.
    const cookieCarrier = new NextResponse()

    // Use the same getAll/setAll cookie adapter middleware.ts reads with,
    // so signInWithPassword's session is persisted in the exact format
    // @supabase/ssr expects to read back (JSON, chunked if needed).
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            cookieCarrier.cookies.set(name, value, options)
          }
        },
      },
    })

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    // The auth provider throttles per server address, and every user shares ours. That is its limit
    // being hit, not this person's wrong password: say so and do not count it against them.
    if (error?.status === 429) {
      console.error('Sign-in throttled by auth provider:', error.code)
      return NextResponse.json({ error: 'Sign-in is busy right now. Please try again in a minute.' }, { status: 429 })
    }

    if (error || !data.session) {
      byPair.fail(pair)
      byIp.fail(ip)
      byEmail.fail(email)
      // Hidden from the user, but kept in the server log so a provider-side limit or outage is visible
      if (error && !SAFE_MESSAGES.has(error.message)) console.error('Sign-in rejected by auth provider:', error.status, error.code)
      const message = error && SAFE_MESSAGES.has(error.message) ? error.message : 'Sign in failed'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    byPair.reset(pair)
    // The browser only needs to know it worked; it never reads the user object
    return NextResponse.json({ message: 'Login successful' }, { headers: cookieCarrier.headers })
  } catch (error) {
    console.error('Login failed:', error)
    return NextResponse.json({ error: 'Sign in failed' }, { status: 500 })
  }
}
