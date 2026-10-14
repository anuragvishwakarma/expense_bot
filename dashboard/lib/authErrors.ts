// Supabase's error text is meant for developers. Show a visitor only the messages they can act on
// (password rules, a mistyped email, slow down); anything else becomes a plain fallback and the
// details go to the server log. Never send raw database or provider text to the browser.
const ACTIONABLE = [/password/i, /valid (e-?mail|address)/i, /e-?mail.*(invalid|not valid)/i, /rate limit/i, /too many/i]

export function friendlyAuthError(error: { message?: string; status?: number; code?: string }, fallback: string): string {
  const message = error.message ?? ''
  if (ACTIONABLE.some(re => re.test(message))) return message
  console.error('Auth provider error hidden from the client:', error.status, error.code)
  return fallback
}
