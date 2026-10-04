/** @jest-environment node */
import { NextRequest } from 'next/server'

const log: string[] = []
let authUser: string | null = 'auth-a'
let profile: { id: string } | null = { id: 'p1' }
let failTable: string | null = null

jest.mock('@/lib/auth', () => ({ getUserIdFromRequest: async () => authUser }))
jest.mock('@/lib/supabase', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => {
      const b: any = {}
      b.select = () => b
      b.maybeSingle = () => Promise.resolve({ data: profile, error: null })
      b.delete = () => { b.__op = 'delete'; return b }
      b.update = (p: unknown) => { b.__op = `update ${JSON.stringify(p)}`; return b }
      b.eq = () => {
        if (!b.__op) return b
        log.push(`${b.__op} ${table}`)
        return Promise.resolve({ error: failTable === table ? { message: 'boom secret detail' } : null })
      }
      return b
    },
    auth: { admin: { deleteUser: async (id: string) => { log.push(`deleteUser ${id}`); return { error: null } } } },
  }),
}))

import { POST } from '../app/api/delete-account/route'
import { USER_TABLES_IN_DELETE_ORDER } from '@/lib/deleteAccount'

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/delete-account', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'sb-x-auth-token=abc; other=1', ...headers },
    body: JSON.stringify(body),
  })

describe('POST /api/delete-account', () => {
  beforeEach(() => { log.length = 0; authUser = 'auth-a'; profile = { id: 'p1' }; failTable = null })

  it('requires a signed-in user', async () => {
    authUser = null
    expect((await POST(req({ confirm: 'DELETE' }))).status).toBe(401)
    expect(log).toHaveLength(0)
  })

  it('refuses cross-site requests', async () => {
    const res = await POST(req({ confirm: 'DELETE' }, { origin: 'https://evil.example' }))
    expect(res.status).toBe(403)
    expect(log).toHaveLength(0)
  })

  it('needs the exact confirmation word', async () => {
    for (const confirm of ['delete', 'yes', '', undefined]) expect((await POST(req({ confirm }))).status).toBe(400)
    expect(log).toHaveLength(0)
  })

  it('deletes data in dependency order, then the login, then the profile, and clears the session cookies', async () => {
    const res = await POST(req({ confirm: 'DELETE' }, { origin: 'http://localhost' }))
    expect(res.status).toBe(200)
    expect(log).toEqual([
      ...USER_TABLES_IN_DELETE_ORDER.map(t => `delete ${t}`),
      'update {"auth_user_id":null} users',
      'deleteUser auth-a',
      'delete users',
    ])
    expect(res.headers.getSetCookie().join(' ')).toMatch(/sb-x-auth-token=;/)
  })

  it('deletes just the login when it was never linked to a profile', async () => {
    profile = null
    const res = await POST(req({ confirm: 'DELETE' }))
    expect(res.status).toBe(200)
    expect(log).toEqual(['deleteUser auth-a'])
  })

  it('hides internal error details from the response', async () => {
    failTable = 'goals'
    const res = await POST(req({ confirm: 'DELETE' }))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toMatch(/boom|secret/)
    expect(log.some(l => l.startsWith('deleteUser'))).toBe(false)
  })
})
