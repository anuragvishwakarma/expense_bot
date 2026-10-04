import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Liveness for Railway and uptime monitors: the site is up and the database answers.
// Booleans only, so it reveals nothing about the setup.
export async function GET() {
  let db = false
  try {
    const ping = getServiceSupabase().from('users').select('id').limit(1)
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    const { error } = await Promise.race([ping, timeout])
    db = !error
  } catch {
    db = false
  }
  return NextResponse.json({ ok: db, db }, { status: db ? 200 : 503, headers: { 'cache-control': 'no-store' } })
}
