import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { safeNext } from '@/lib/authRedirect'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Landing point of the password-reset email. Turns the link's PKCE code into a session, then sends
// the user to the "set a new password" page. The code only works in the browser that asked for the
// reset (it needs the verifier cookie set then), which is what stops a crafted link from signing a
// victim's browser in as an attacker. A cross-device link (?token_hash=) has no such binding and is
// deliberately not accepted.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const failure = NextResponse.redirect(new URL('/forgot-password?error=expired', request.url))
  const success = NextResponse.redirect(new URL(safeNext(searchParams.get('next')), request.url))

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) success.cookies.set(name, value, options)
      },
    },
  })

  const code = searchParams.get('code')
  if (!code) return failure
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  return error ? failure : success
}
