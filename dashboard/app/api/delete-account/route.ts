import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserIdFromRequest } from '@/lib/auth'
import { createFailureTracker } from '@/lib/rateLimit'
import { getServiceSupabase } from '@/lib/supabase'
import { deleteAccount } from '@/lib/deleteAccount'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// A stolen session cookie must not be enough to wipe an account, so the password is asked again.
// Wrong answers are capped per account, or this route would be a password-guessing oracle.
const wrongPassword = createFailureTracker(5, 15 * 60 * 1000)

export async function POST(request: NextRequest) {
  // A cross-site page must not be able to trigger this, even if the browser attaches cookies
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const authUserId = await getUserIdFromRequest()
  if (!authUserId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 })
  }
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!password) {
    return NextResponse.json({ error: 'Enter your password to confirm.' }, { status: 400 })
  }
  if (wrongPassword.isBlocked(authUserId)) {
    return NextResponse.json({ error: 'Too many wrong passwords. Please wait a few minutes and try again.' }, { status: 429 })
  }

  try {
    const service = getServiceSupabase()
    const { data: found, error: lookupError } = await service.auth.admin.getUserById(authUserId)
    const email = found?.user?.email
    if (lookupError || !email) throw new Error('Could not look up the login')

    // Throwaway client: checks the password without touching the caller's session cookies
    const checker = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: passwordError } = await checker.auth.signInWithPassword({ email, password })
    if (passwordError?.status === 429) {
      return NextResponse.json({ error: 'Sign-in is busy right now. Please try again in a minute.' }, { status: 429 })
    }
    if (passwordError) {
      wrongPassword.fail(authUserId)
      return NextResponse.json({ error: 'That password is not correct.' }, { status: 403 })
    }
    wrongPassword.reset(authUserId)

    const { profileDeleted } = await deleteAccount(service, authUserId)
    const res = NextResponse.json({ message: 'Account deleted', profileDeleted })
    // The session belongs to a login that no longer exists; drop its cookies
    for (const { name } of request.cookies.getAll()) {
      if (name.startsWith('sb-')) res.cookies.delete(name)
    }
    return res
  } catch (error) {
    console.error('Delete account failed:', error)
    return NextResponse.json({ error: 'Could not delete everything. Please try again.' }, { status: 500 })
  }
}
