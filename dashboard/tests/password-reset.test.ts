/** @jest-environment node */
import { NextRequest } from 'next/server'

const calls: { fn: string; args: unknown[] }[] = []
let authUser: string | null = 'u1'
let authError: { message: string } | null = null
const record = (fn: string) => async (...args: unknown[]) => { calls.push({ fn, args }); return { error: authError, data: {} } }

jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      resetPasswordForEmail: record('resetPasswordForEmail'),
      exchangeCodeForSession: record('exchangeCodeForSession'),
      verifyOtp: record('verifyOtp'),
      updateUser: record('updateUser'),
      signOut: record('signOut'),
    },
  }),
}))
jest.mock('@/lib/auth', () => ({ getUserIdFromRequest: async () => authUser }))

import { POST as forgot } from '../app/api/auth/forgot-password/route'
import { POST as reset } from '../app/api/auth/reset-password/route'
import { GET as callback } from '../app/auth/callback/route'
import { safeNext } from '@/lib/authRedirect'
import { createRateLimiter } from '@/lib/rateLimit'

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })
const get = (qs: string) => new NextRequest(`http://localhost/auth/callback?${qs}`)

beforeEach(() => { calls.length = 0; authUser = 'u1'; authError = null; process.env.NEXT_PUBLIC_SITE_URL = 'https://dash.example' })

describe('POST /api/auth/forgot-password', () => {
  it('asks Supabase to email a link that returns through our callback', async () => {
    const res = await forgot(post('/api/auth/forgot-password', { email: ' Me@Example.com ' }, { 'x-forwarded-for': '10.0.0.1' }))
    expect(res.status).toBe(200)
    expect(calls[0].fn).toBe('resetPasswordForEmail')
    expect(calls[0].args).toEqual(['me@example.com', { redirectTo: 'https://dash.example/auth/callback?next=/reset-password' }])
  })

  it('rejects malformed emails without calling Supabase', async () => {
    for (const email of ['', 'nope', 'a@b', 'x'.repeat(300) + '@a.co', 42, undefined]) {
      expect((await forgot(post('/api/auth/forgot-password', { email }, { 'x-forwarded-for': '10.0.0.2' }))).status).toBe(400)
    }
    expect((await forgot(post('/api/auth/forgot-password', '{bad', { 'x-forwarded-for': '10.0.0.2' }))).status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('gives the same answer when Supabase fails, so account existence cannot be probed', async () => {
    const ok = await (await forgot(post('/api/auth/forgot-password', { email: 'known@example.com' }, { 'x-forwarded-for': '10.0.0.3' }))).json()
    authError = { message: 'User not found' }
    const failed = await (await forgot(post('/api/auth/forgot-password', { email: 'unknown@example.com' }, { 'x-forwarded-for': '10.0.0.4' }))).json()
    expect(failed).toEqual(ok)
  })

  it('stops sending after 3 requests for one email, with the normal answer', async () => {
    const send = () => forgot(post('/api/auth/forgot-password', { email: 'flood@example.com' }, { 'x-forwarded-for': `10.1.0.${calls.length}` }))
    for (let i = 0; i < 5; i++) expect((await send()).status).toBe(200)
    expect(calls.filter(c => c.fn === 'resetPasswordForEmail')).toHaveLength(3)
  })

  it('stops sending after 10 requests from one address', async () => {
    for (let i = 0; i < 14; i++) await forgot(post('/api/auth/forgot-password', { email: `user${i}@example.com` }, { 'x-forwarded-for': '10.2.0.1' }))
    expect(calls.filter(c => c.fn === 'resetPasswordForEmail')).toHaveLength(10)
  })
})

describe('GET /auth/callback', () => {
  it('turns a PKCE code into a session and goes to the new-password page', async () => {
    const res = await callback(get('code=abc&next=/reset-password'))
    expect(calls[0]).toEqual({ fn: 'exchangeCodeForSession', args: ['abc'] })
    expect(new URL(res.headers.get('location')!).pathname).toBe('/reset-password')
  })

  it('refuses token_hash links: they are not bound to the requesting browser (login CSRF)', async () => {
    for (const qs of ['token_hash=th&type=recovery', 'token_hash=th&type=magiclink']) {
      calls.length = 0
      const res = await callback(get(qs))
      expect(calls).toHaveLength(0)
      expect(res.headers.get('location')).toContain('/forgot-password?error=expired')
    }
  })

  it('sends an expired or reused link to the request page', async () => {
    authError = { message: 'expired' }
    expect((await callback(get('code=abc'))).headers.get('location')).toContain('/forgot-password?error=expired')
    authError = null
    expect((await callback(get(''))).headers.get('location')).toContain('/forgot-password?error=expired')
    expect(calls.filter(c => c.fn === 'exchangeCodeForSession')).toHaveLength(1) // the empty link never reached Supabase
  })

  it('never redirects anywhere but the allowlist (no open redirect)', async () => {
    for (const next of ['https://evil.example', '//evil.example', '/settings', '/login']) {
      const loc = (await callback(get(`code=abc&next=${encodeURIComponent(next)}`))).headers.get('location')!
      expect(new URL(loc).origin).toBe('http://localhost')
      expect(new URL(loc).pathname).toBe('/reset-password')
    }
    expect(safeNext(null)).toBe('/reset-password')
  })
})

describe('POST /api/auth/reset-password', () => {
  it('needs the session the reset link created', async () => {
    authUser = null
    expect((await reset(post('/api/auth/reset-password', { password: 'long-enough-1' }))).status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('refuses cross-site requests', async () => {
    expect((await reset(post('/api/auth/reset-password', { password: 'long-enough-1' }, { origin: 'https://evil.example' }))).status).toBe(403)
    expect(calls).toHaveLength(0)
  })

  it('enforces length limits', async () => {
    for (const password of ['short', '', 'x'.repeat(73), 12345678, undefined]) {
      expect((await reset(post('/api/auth/reset-password', { password }))).status).toBe(400)
    }
    expect(calls).toHaveLength(0)
  })

  it('updates the password and signs every other session out', async () => {
    const res = await reset(post('/api/auth/reset-password', { password: 'long-enough-1' }, { origin: 'http://localhost' }))
    expect(res.status).toBe(200)
    expect(calls.map(c => c.fn)).toEqual(['updateUser', 'signOut'])
    expect(calls[0].args).toEqual([{ password: 'long-enough-1' }])
    expect(calls[1].args).toEqual([{ scope: 'others' }])
  })

  it("passes Supabase's own message on (same password, weak password) without signing others out", async () => {
    authError = { message: 'New password should be different from the old password.' }
    const res = await reset(post('/api/auth/reset-password', { password: 'long-enough-1' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/different/)
    expect(calls.map(c => c.fn)).toEqual(['updateUser'])
  })
})

describe('createRateLimiter', () => {
  it('allows max hits per window, then blocks, then resets', () => {
    const limited = createRateLimiter(2, 1000)
    expect([limited('k', 0), limited('k', 1), limited('k', 2)]).toEqual([false, false, true])
    expect(limited('other', 3)).toBe(false)
    expect(limited('k', 1500)).toBe(false) // new window
  })
})
