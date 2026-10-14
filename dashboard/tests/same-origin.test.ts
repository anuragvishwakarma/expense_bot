/** @jest-environment node */
import { NextRequest } from 'next/server'
import { isCrossSite } from '@/lib/sameOrigin'

// Behind Railway the app sees its internal address in the URL; the public host arrives in headers
const behindProxy = (headers: Record<string, string>) =>
  new NextRequest('http://localhost:8080/api/x', { method: 'POST', headers })
const PUBLIC = 'dash.example'

describe('isCrossSite', () => {
  it('accepts the public origin when the URL shows the internal address (Railway proxy)', () => {
    expect(isCrossSite(behindProxy({ origin: `https://${PUBLIC}`, 'x-forwarded-host': PUBLIC, host: 'localhost:8080' }))).toBe(false)
    expect(isCrossSite(behindProxy({ origin: `https://${PUBLIC}`, host: PUBLIC }))).toBe(false)
  })

  it('rejects a foreign origin, including one that merely contains or extends ours', () => {
    for (const origin of ['https://evil.example', `https://${PUBLIC}.evil.example`, `https://evil.example/${PUBLIC}`, `https://x.${PUBLIC}`, 'null', 'not a url']) {
      expect(isCrossSite(behindProxy({ origin, 'x-forwarded-host': PUBLIC, host: 'localhost:8080' }))).toBe(true)
    }
  })

  it('does not trust a spoofed Origin that matches only the internal address', () => {
    expect(isCrossSite(behindProxy({ origin: 'https://evil.example', host: 'localhost:8080' }))).toBe(true)
  })

  it('treats a request with no Origin as not cross-site (curl, server calls)', () => {
    expect(isCrossSite(behindProxy({ host: PUBLIC }))).toBe(false)
  })

  it('works when the URL itself carries the right host (local dev)', () => {
    expect(isCrossSite(new NextRequest('http://localhost:3000/x', { method: 'POST', headers: { origin: 'http://localhost:3000' } }))).toBe(false)
  })
})
