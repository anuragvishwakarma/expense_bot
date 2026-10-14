/** @jest-environment node */
import { NextRequest } from 'next/server'

const signOut = jest.fn(async () => ({ error: null }))
jest.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { signOut } }) }))

import { GET } from '../app/logout/route'

const logout = (headers: Record<string, string> = {}) => GET(new NextRequest('http://localhost/logout', { headers }))

beforeEach(() => signOut.mockClear())

describe('GET /logout', () => {
  it('refuses a cross-site navigation without signing the user out', async () => {
    const res = await logout({ 'sec-fetch-site': 'cross-site' })
    expect(res.status).toBe(403)
    expect(signOut).not.toHaveBeenCalled()
  })

  it.each(['same-origin', 'none'])('signs out and redirects to /login for sec-fetch-site: %s', async site => {
    const res = await logout({ 'sec-fetch-site': site })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login')
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('still works when the header is absent (older browsers, curl)', async () => {
    expect((await logout()).status).toBe(307)
  })
})
