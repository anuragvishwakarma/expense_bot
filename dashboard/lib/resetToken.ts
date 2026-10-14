import { createHmac, timingSafeEqual } from 'crypto'

// Proof that this browser redeemed a reset link for this user: "<userId>.<issuedAtMs>.<hmac>".
// Signed with a server-only secret, so someone holding only a stolen session cookie cannot forge it.
// ponytail: keyed with the service-role key rather than a new env var; add RESET_COOKIE_SECRET if
// that key is ever rotated often. Replay within the 15 minutes is possible (no server-side nonce).
export const RESET_COOKIE = 'pw_reset'
export const RESET_MAX_AGE_S = 15 * 60

const mac = (userId: string, issuedAt: number) => {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set')
  return createHmac('sha256', secret).update(`${userId}.${issuedAt}`).digest('hex')
}

export const signResetToken = (userId: string, now = Date.now()) => `${userId}.${now}.${mac(userId, now)}`

export function verifyResetToken(token: string | undefined, userId: string, now = Date.now()): boolean {
  const [id, ts, sig] = (token ?? '').split('.')
  const issuedAt = Number(ts)
  if (!id || !sig || id !== userId || !Number.isFinite(issuedAt)) return false
  if (issuedAt > now || now - issuedAt > RESET_MAX_AGE_S * 1000) return false
  const a = Buffer.from(sig)
  const b = Buffer.from(mac(userId, issuedAt))
  return a.length === b.length && timingSafeEqual(a, b)
}
