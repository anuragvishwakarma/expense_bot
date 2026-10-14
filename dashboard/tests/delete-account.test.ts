/** @jest-environment node */
import { NextRequest } from 'next/server'

const log: string[] = []
let authUser: string | null = 'auth-a'
let profile: { id: string } | null = { id: 'p1' }
let failTable: string | null = null
let signInResult: { error: { status?: number; message: string } | null } = { error: null }
const signIns: unknown[] = []

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signInWithPassword: async (c: unknown) => { signIns.push(c); await new Promise(r => setTimeout(r, 5)); return signInResult } } }),
}))

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
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'me@example.com' } }, error: null }), deleteUser: async (id: string) => { log.push(`deleteUser ${id}`); return { error: null } } } },
  }),
}))

import { POST } from '../app/api/delete-account/route'
import { USER_TABLES_IN_DELETE_ORDER } from '@/lib/deleteAccount'

const OK = { confirm: 'DELETE', password: 'my-password' }
const req = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/delete-account', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'sb-x-auth-token=abc; other=1', ...headers },
    body: JSON.stringify(body),
  })

describe('POST /api/delete-account', () => {
  beforeEach(() => { signIns.length = 0; signInResult = { error: null }; log.length = 0; authUser = 'auth-a'; profile = { id: 'p1' }; failTable = null })

  it('requires a signed-in user', async () => {
    authUser = null
    expect((await POST(req(OK))).status).toBe(401)
    expect(log).toHaveLength(0)
  })

  it('refuses cross-site requests', async () => {
    const res = await POST(req(OK, { origin: 'https://evil.example' }))
    expect(res.status).toBe(403)
    expect(log).toHaveLength(0)
  })

  it('asks for the password again, so a stolen session cookie cannot wipe the account', async () => {
    for (const password of ['', undefined, 42]) expect((await POST(req({ confirm: 'DELETE', password }))).status).toBe(400)
    expect(signIns).toHaveLength(0)
    expect(log).toHaveLength(0)
  })

  it('refuses a wrong password and deletes nothing', async () => {
    signInResult = { error: { status: 400, message: 'Invalid login credentials' } }
    const res = await POST(req(OK))
    expect(res.status).toBe(403)
    expect(log).toHaveLength(0)
  })

  it('checks the password against the login email', async () => {
    await POST(req(OK))
    expect(signIns).toEqual([{ email: 'me@example.com', password: 'my-password' }])
  })

  it('locks the account after 5 wrong passwords, even if the 6th is right', async () => {
    authUser = 'auth-brute'
    signInResult = { error: { status: 400, message: 'Invalid login credentials' } }
    for (let i = 0; i < 5; i++) expect((await POST(req(OK))).status).toBe(403)
    signInResult = { error: null }
    const res = await POST(req(OK))
    expect(res.status).toBe(429)
    expect(signIns).toHaveLength(5)
    expect(log).toHaveLength(0)
  })

  it('cannot be beaten by parallel guesses: only one check runs at a time per account', async () => {
    authUser = 'auth-race'
    signInResult = { error: { status: 400, message: 'Invalid login credentials' } }
    const statuses = (await Promise.all(Array.from({ length: 20 }, () => POST(req(OK))))).map(r => r.status)
    expect(statuses.filter(s => s === 403)).toHaveLength(1)
    expect(statuses.filter(s => s === 429)).toHaveLength(19)
    expect(signIns).toHaveLength(1)
  })

  it('does not count provider throttling as a wrong password', async () => {
    authUser = 'auth-busy'
    signInResult = { error: { status: 429, message: 'rate limit' } }
    for (let i = 0; i < 7; i++) expect((await POST(req(OK))).status).toBe(429)
    signInResult = { error: null }
    expect((await POST(req(OK))).status).toBe(200)
  })

  it('needs the exact confirmation word', async () => {
    for (const confirm of ['delete', 'yes', '', undefined]) expect((await POST(req({ confirm, password: 'x' }))).status).toBe(400)
    expect(log).toHaveLength(0)
  })

  it('deletes data in dependency order, then the login, then the profile, and clears the session cookies', async () => {
    const res = await POST(req(OK, { origin: 'http://localhost' }))
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
    const res = await POST(req(OK))
    expect(res.status).toBe(200)
    expect(log).toEqual(['deleteUser auth-a'])
  })

  it('hides internal error details from the response', async () => {
    failTable = 'goals'
    const res = await POST(req(OK))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toMatch(/boom|secret/)
    expect(log.some(l => l.startsWith('deleteUser'))).toBe(false)
  })
})
