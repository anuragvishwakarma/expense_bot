// Where the email-link callback may send the user afterwards. A fixed allowlist, so a crafted
// link can never turn the callback into an open redirect.
const ALLOWED = new Set(['/reset-password'])
export const safeNext = (next: string | null) => (next && ALLOWED.has(next) ? next : '/reset-password')
