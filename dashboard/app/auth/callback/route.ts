import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { safeNext } from '@/lib/authRedirect'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Landing point of the password-reset email. Turns the link into a session, then sends the user
// to the "set a new password" page. Supports both the default PKCE link (?code=, same browser)
// and the cross-device link (?token_hash=&type=recovery) used if the email template is changed.
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
  const tokenHash = searchParams.get('token_hash')
  let error: unknown = new Error('missing code')
  if (tokenHash && searchParams.get('type') === 'recovery') {
    ;({ error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash }))
  } else if (code) {
    ;({ error } = await supabase.auth.exchangeCodeForSession(code))
  }

  return error ? failure : success
}
