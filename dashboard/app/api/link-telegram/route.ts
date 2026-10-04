import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'
import { getUserIdFromRequest } from '@/lib/auth'
import { getServiceSupabase } from '@/lib/supabase'

const MAX_ATTEMPTS = 5
const MAX_ATTEMPTS_PER_IP = 20 // many throwaway logins from one address share this budget
const WINDOW_MS = 10 * 60 * 1000

// ponytail: in-memory, per-instance rate limit. Resets on redeploy/cold start
// and doesn't share state across instances. Good enough for a single-user
// app; move to a DB-backed counter if this ever runs multi-instance.
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string, max = MAX_ATTEMPTS): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > max
}

function clearAttempts(key: string) {
  attempts.delete(key)
}

export async function POST(request: NextRequest) {
  const authUserId = await getUserIdFromRequest()
  if (!authUserId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  // Railway's edge sets the leftmost X-Forwarded-For entry to the real client (see signup route).
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(`ip:${ip}`, MAX_ATTEMPTS_PER_IP) || isRateLimited(authUserId)) {
    return NextResponse.json(
      { error: 'Too many attempts. Send /link again and wait a few minutes before retrying.' },
      { status: 429 }
    )
  }

  const { code } = await request.json()
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex')
  const supabase = getServiceSupabase()

  const { data: botUser, error: findError } = await supabase
    .from('users')
    .select('id, link_code_expires_at, auth_user_id')
    .eq('link_code_hash', codeHash)
    .single()

  if (findError || !botUser) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  if (!botUser.link_code_expires_at || new Date(botUser.link_code_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Code has expired. Send /link again.' }, { status: 400 })
  }

  // A code must never re-point a profile that already belongs to another login.
  if (botUser.auth_user_id && botUser.auth_user_id !== authUserId) {
    return NextResponse.json(
      { error: 'This Telegram profile is already linked to a different dashboard login. Send /unlink in the bot first, then /link again.' },
      { status: 409 }
    )
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ auth_user_id: authUserId, link_code_hash: null, link_code_expires_at: null })
    .eq('id', botUser.id)

  if (updateError) {
    if (updateError.code === '23505') {
      return NextResponse.json(
        { error: 'This dashboard account is already linked to a different Telegram user.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  clearAttempts(authUserId)
  return NextResponse.json({ message: 'Linked successfully' })
}
