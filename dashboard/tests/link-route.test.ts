/** @jest-environment node */
import { NextRequest } from 'next/server'

let authUser: string | null = 'auth-a'
let botUser: any = null
const updates: any[] = []

jest.mock('@/lib/auth', () => ({ getUserIdFromRequest: async () => authUser }))
jest.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => {
    const b: any = {}
    b.select = () => b
    b.eq = () => (b.__update ? Promise.resolve({ error: null }) : b)
    b.single = () => Promise.resolve(botUser ? { data: botUser, error: null } : { data: null, error: { code: 'PGRST116' } })
    b.update = (payload: any) => { updates.push(payload); b.__update = true; return b }
    return { from: () => b }
  },
}))

import { POST } from '../app/api/link-telegram/route'

const req = (code: unknown, ip = '1.1.1.1') =>
  new NextRequest('http://localhost/api/link-telegram', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ code }),
  })
const future = () => new Date(Date.now() + 60_000).toISOString()

describe('POST /api/link-telegram', () => {
  beforeEach(() => { authUser = 'auth-a'; botUser = null; updates.length = 0 })

  it('requires a signed-in user', async () => {
    authUser = null
    expect((await POST(req('12345678', '2.2.2.2'))).status).toBe(401)
  })

  it('links an unlinked profile with a valid code', async () => {
    botUser = { id: 'b1', link_code_expires_at: future(), auth_user_id: null }
    const res = await POST(req('12345678', '3.3.3.3'))
    expect(res.status).toBe(200)
    expect(updates[0]).toMatchObject({ auth_user_id: 'auth-a', link_code_hash: null })
  })

  it('refuses to re-point a profile that belongs to a different login', async () => {
    botUser = { id: 'b1', link_code_expires_at: future(), auth_user_id: 'auth-victim' }
    const res = await POST(req('12345678', '4.4.4.4'))
    expect(res.status).toBe(409)
    expect(updates).toHaveLength(0)
  })

  it('lets the same login re-run linking on its own profile', async () => {
    botUser = { id: 'b1', link_code_expires_at: future(), auth_user_id: 'auth-a' }
    expect((await POST(req('12345678', '5.5.5.5'))).status).toBe(200)
  })

  it('throttles one address across many logins', async () => {
    botUser = null
    const statuses: number[] = []
    for (let i = 0; i < 24; i++) {
      authUser = `auth-${i}` // a fresh login each time dodges the per-user limit
      statuses.push((await POST(req('00000000', '9.9.9.9'))).status)
    }
    expect(statuses.slice(0, 20).every(s => s === 400)).toBe(true)
    expect(statuses.slice(20)).toEqual([429, 429, 429, 429])
  })
})
