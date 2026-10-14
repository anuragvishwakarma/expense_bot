// Session cookie attributes for every server-side Supabase client. The browser never talks to
// Supabase itself (only server code does), so no page script has any need to read these cookies:
// httpOnly keeps a stolen-by-script session out of reach, secure keeps them off plain http.
// @supabase/ssr defaults to httpOnly:false and no Secure flag.
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}
