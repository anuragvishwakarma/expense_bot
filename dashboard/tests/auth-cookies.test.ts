/** @jest-environment node */
import { NextRequest } from 'next/server'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

// Real @supabase/ssr and the real login route; only the HTTP call to Supabase is faked
const session = {
  access_token: 'a.b.c', refresh_token: 'r', token_type: 'bearer', expires_in: 3600,
  user: { id: 'u1', email: 'me@example.com', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
}
const realFetch = global.fetch
beforeEach(() => {
  global.fetch = jest.fn(async () => new Response(JSON.stringify(session), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
})
afterEach(() => { global.fetch = realFetch })

import { POST as login } from '../app/api/auth/login/route'

describe('session cookies', () => {
  it('are httpOnly, SameSite=Lax and path=/ so page scripts cannot read the session', async () => {
    const res = await login(new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
      body: JSON.stringify({ email: 'me@example.com', password: 'whatever-123' }),
    }))
    expect(res.status).toBe(200)
    const cookies = res.headers.getSetCookie().filter(c => c.startsWith('sb-'))
    expect(cookies.length).toBeGreaterThan(0)
    for (const c of cookies) {
      expect(c).toMatch(/HttpOnly/i)
      expect(c).toMatch(/SameSite=lax/i)
      expect(c).toMatch(/Path=\//i)
    }
  })

  it('also carry Secure in production', async () => {
    jest.resetModules()
    const env = process.env as Record<string, string>
    const old = env.NODE_ENV
    env.NODE_ENV = 'production'
    try {
      const { POST } = await import('../app/api/auth/login/route')
      const res = await POST(new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.8' },
        body: JSON.stringify({ email: 'me@example.com', password: 'whatever-123' }),
      }))
      const cookies = res.headers.getSetCookie().filter(c => c.startsWith('sb-'))
      expect(cookies.length).toBeGreaterThan(0)
      for (const c of cookies) expect(c).toMatch(/Secure/i)
    } finally {
      env.NODE_ENV = old
    }
  })
})
