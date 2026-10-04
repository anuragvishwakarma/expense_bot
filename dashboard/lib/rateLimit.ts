// ponytail: in-memory, per-instance fixed-window limiter (same tradeoff as the signup and link
// routes). Resets on redeploy and is not shared across instances; use a DB-backed counter if
// this ever runs multi-instance or abuse shows up.
export function createRateLimiter(max: number, windowMs: number, maxTracked = 10_000) {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return (key: string, now = Date.now()): boolean => {
    if (hits.size > maxTracked) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k)
    }
    const entry = hits.get(key)
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return false
    }
    entry.count += 1
    return entry.count > max
  }
}

// Leftmost X-Forwarded-For entry is the real client behind Railway's edge (see the signup route)
export const clientIp = (headers: Headers) => headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

// Counts failed attempts only. Check isBlocked() before trying, call fail() after a wrong
// answer and reset() after a right one, so honest users who mistype once are never affected.
// ponytail: in-memory like createRateLimiter above; same per-instance, resets-on-deploy ceiling.
export function createFailureTracker(max: number, windowMs: number, maxTracked = 10_000) {
  const fails = new Map<string, { count: number; resetAt: number }>()
  return {
    isBlocked(key: string, now = Date.now()): boolean {
      const e = fails.get(key)
      return !!e && now <= e.resetAt && e.count >= max
    },
    fail(key: string, now = Date.now()) {
      if (fails.size > maxTracked) {
        for (const [k, v] of fails) if (now > v.resetAt) fails.delete(k)
      }
      const e = fails.get(key)
      if (!e || now > e.resetAt) fails.set(key, { count: 1, resetAt: now + windowMs })
      else e.count += 1
    },
    reset(key: string) {
      fails.delete(key)
    },
  }
}
