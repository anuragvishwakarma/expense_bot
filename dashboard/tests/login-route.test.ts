/** @jest-environment node */
import { NextRequest } from 'next/server'

let signIn: jest.Mock
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { signInWithPassword: (...a: unknown[]) => signIn(...a) } }),
}))

import { POST } from '../app/api/auth/login/route'
import { createFailureTracker } from '@/lib/rateLimit'

let n = 0
const login = (email: unknown, password: unknown, ip = `198.51.100.${++n}`) =>
  POST(new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof email === 'string' && email.startsWith('{') ? email : JSON.stringify({ email, password }),
  }))
const wrong = () => ({ data: { session: null, user: null }, error: { message: 'Invalid login credentials' } })
const right = () => ({ data: { session: { access_token: 'x' }, user: { id: 'u1', email: 'a@b.co' } }, error: null })

beforeEach(() => { signIn = jest.fn(async () => wrong()) })

describe('POST /api/auth/login', () => {
  it('signs in with a normalised email and does not echo the user object', async () => {
    signIn.mockResolvedValue(right())
    const res = await login(' Me@Example.com ', 'pw-pw-pw-1')
    expect(res.status).toBe(200)
    expect(signIn).toHaveBeenCalledWith({ email: 'me@example.com', password: 'pw-pw-pw-1' })
    expect(await res.json()).toEqual({ message: 'Login successful' })
  })

  it('rejects malformed bodies cleanly, without parser text or a Supabase call', async () => {
    for (const res of [await login('{bad', undefined), await login('', 'x'), await login('a@b.co', ''), await login(5, 'x')]) {
      expect(res.status).toBe(400)
      expect(JSON.stringify(await res.json())).not.toMatch(/JSON|position|Unexpected/)
    }
    expect(signIn).not.toHaveBeenCalled()
  })

  it('shows only vetted error messages', async () => {
    expect((await (await login('a@b.co', 'x')).json()).error).toBe('Invalid login credentials')
    signIn.mockResolvedValue({ data: { session: null }, error: { message: 'some internal GoTrue detail' } })
    expect((await (await login('a@b.co', 'x')).json()).error).toBe('Sign in failed')
  })

  it('blocks the 6th wrong attempt for one account from one address, before asking Supabase', async () => {
    const ip = '203.0.113.50'
    for (let i = 0; i < 5; i++) expect((await login('victim@x.co', `bad${i}`, ip)).status).toBe(400)
    signIn.mockClear()
    const res = await login('victim@x.co', 'bad6', ip)
    expect(res.status).toBe(429)
    expect(signIn).not.toHaveBeenCalled()
    // even the right password is refused while blocked
    signIn.mockResolvedValue(right())
    expect((await login('victim@x.co', 'correct', ip)).status).toBe(429)
  })

  it('does not let an attacker lock the real owner out: another address still signs in', async () => {
    for (let i = 0; i < 6; i++) await login('owner@x.co', `bad${i}`, '203.0.113.60')
    signIn.mockResolvedValue(right())
    expect((await login('owner@x.co', 'correct', '192.0.2.77')).status).toBe(200)
  })

  it('a successful sign in clears that address and account pair', async () => {
    const ip = '203.0.113.70'
    for (let i = 0; i < 4; i++) await login('reset@x.co', `bad${i}`, ip)
    signIn.mockResolvedValue(right())
    expect((await login('reset@x.co', 'correct', ip)).status).toBe(200)
    signIn.mockResolvedValue(wrong())
    for (let i = 0; i < 5; i++) expect((await login('reset@x.co', `bad${i}`, ip)).status).toBe(400) // a fresh budget of 5
  })

  it('stops one address from trying many accounts (20 failures)', async () => {
    const ip = '203.0.113.80'
    for (let i = 0; i < 20; i++) expect((await login(`user${i}@x.co`, 'bad', ip)).status).toBe(400)
    expect((await login('another@x.co', 'bad', ip)).status).toBe(429)
  })

  it('caps distributed guessing against one account (50 failures from many addresses)', async () => {
    for (let i = 0; i < 50; i++) await login('target@x.co', 'bad', `192.0.3.${i}`)
    expect((await login('target@x.co', 'bad', '192.0.4.1')).status).toBe(429)
  })
})

describe('provider throttling', () => {
  it("tells the user to retry and does not count Supabase's own 429 as their wrong password", async () => {
    const ip = '203.0.113.200'
    signIn.mockResolvedValue({ data: { session: null, user: null }, error: { status: 429, code: 'over_request_rate_limit', message: 'rate limit' } })
    for (let i = 0; i < 8; i++) {
      const res = await login('busy@x.co', 'whatever', ip)
      expect(res.status).toBe(429)
      expect((await res.json()).error).toMatch(/busy right now/)
    }
    // eight provider throttles must not have used up this person's five-failure budget
    signIn.mockResolvedValue(right())
    expect((await login('busy@x.co', 'correct', ip)).status).toBe(200)
  })
})

describe('createFailureTracker', () => {
  it('blocks at max failures, forgets after the window, and resets on success', () => {
    const t = createFailureTracker(2, 1000)
    t.fail('k', 0); expect(t.isBlocked('k', 1)).toBe(false)
    t.fail('k', 2); expect(t.isBlocked('k', 3)).toBe(true)
    expect(t.isBlocked('k', 1500)).toBe(false)
    t.fail('j', 0); t.fail('j', 1); t.reset('j'); expect(t.isBlocked('j', 2)).toBe(false)
  })
})
