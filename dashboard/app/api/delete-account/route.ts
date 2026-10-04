import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/auth'
import { getServiceSupabase } from '@/lib/supabase'
import { deleteAccount } from '@/lib/deleteAccount'

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

  try {
    const { profileDeleted } = await deleteAccount(getServiceSupabase(), authUserId)
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
