import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Session-aware server client: forwards the caller's auth cookie so
// `auth.uid()` resolves inside RLS policies. Previously this was a bare
// anon-key client with no session, so `auth.uid()` was always null.
export async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(cookie => ({ name: cookie.name, value: cookie.value }))
      },
      setAll(cookiesToSet: any) {
        cookiesToSet.forEach(({ name, value, options }: any) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}

// Service-role client: bypasses RLS. Server-only - never import this from a
// client component. Used for privileged operations like redeeming a /link
// code, where the target row isn't scoped to the caller's own auth.uid() yet.
export function getServiceSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey)
}
