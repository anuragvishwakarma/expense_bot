import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getUserIdFromRequest } from '@/lib/auth'
import { isCrossSite } from '@/lib/sameOrigin'
import { clearAccountFailures } from '@/lib/loginThrottle'
import { RESET_COOKIE, verifyResetToken } from '@/lib/resetToken'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  // A cross-site page must not be able to change the password, even if cookies are attached
  if (isCrossSite(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // The reset link signed the user in and set a signed RESET_COOKIE for that user. A session without
  // it is an ordinary login, which must not be able to set a new password without the old one.
  const userId = await getUserIdFromRequest()
  if (!userId || !verifyResetToken(request.cookies.get(RESET_COOKIE)?.value, userId)) {
    return NextResponse.json({ error: 'This reset link has expired. Request a new one.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const password = body?.password
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }
  if (password.length > 72) {
    return NextResponse.json({ error: 'Password must be at most 72 characters.' }, { status: 400 })
  }

  const cookieCarrier = new NextResponse()
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) cookieCarrier.cookies.set(name, value, options)
      },
    },
  })

  const { data, error } = await supabase.auth.updateUser({ password })
  if (error) {
    // e.g. "New password should be different from the old password." or a weak-password rule
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // The owner just proved control of the email: lift any lockout an attacker caused on this account
  if (data?.user?.email) clearAccountFailures(data.user.email)

  // A changed password should end every other session (a stolen one, an old device)
  await supabase.auth.signOut({ scope: 'others' })

  const res = NextResponse.json({ message: 'Password updated' }, { headers: cookieCarrier.headers })
  res.cookies.delete(RESET_COOKIE) // one reset, one password change
  return res
}
