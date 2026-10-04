/** @jest-environment node */
import { NextRequest } from 'next/server'

let signInOk = false
let user: { email: string } | null = { email: 'owner@example.com' }
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      signInWithPassword: async () => (signInOk
        ? { data: { session: { access_token: 'x' }, user: { id: 'u1' } }, error: null }
        : { data: { session: null, user: null }, error: { message: 'Invalid login credentials' } }),
      updateUser: async () => ({ data: { user }, error: null }),
      signOut: async () => ({ error: null }),
    },
  }),
}))
jest.mock('@/lib/auth', () => ({ getUserIdFromRequest: async () => 'u1' }))

import { POST as login } from '../app/api/auth/login/route'
import { POST as reset } from '../app/api/auth/reset-password/route'

const post = (path: string, body: unknown, ip: string) =>
  new NextRequest(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) })

describe('lockout recovery', () => {
  it('an attacker spread across addresses can lock an account, but a completed password reset lifts it', async () => {
    // 50 failures from 50 different addresses trips the per-account cap
    for (let i = 0; i < 50; i++) await login(post('/api/auth/login', { email: 'owner@example.com', password: 'bad' }, `192.0.9.${i}`))
    signInOk = true
    expect((await login(post('/api/auth/login', { email: 'owner@example.com', password: 'correct' }, '203.0.113.5'))).status).toBe(429)

    // the owner proves control of the email by resetting the password
    const res = await reset(post('/api/auth/reset-password', { password: 'brand-new-pass-1' }, '203.0.113.5'))
    expect(res.status).toBe(200)

    // and can sign in straight away
    expect((await login(post('/api/auth/login', { email: 'owner@example.com', password: 'brand-new-pass-1' }, '203.0.113.5'))).status).toBe(200)
  })
})
