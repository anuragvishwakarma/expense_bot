import type { NextRequest } from 'next/server'

// True when a browser says the request came from a page on another site. Behind Railway's proxy
// request.nextUrl.origin is the server's internal address, not the public one, so compare the
// Origin's host with the host the browser actually asked for (forwarded or plain). A cross-site
// page cannot change the Host its victim's browser sends, so a foreign Origin never matches.
// No Origin header (curl, same-site GET-style navigations) is not treated as cross-site.
export function isCrossSite(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return true
  }
  const hosts = [request.headers.get('x-forwarded-host'), request.headers.get('host'), request.nextUrl.host]
  return !hosts.some((h) => h && h.split(',')[0].trim() === originHost)
}
