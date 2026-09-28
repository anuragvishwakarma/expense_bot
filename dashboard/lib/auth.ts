import { getServerSupabase } from './supabase'

// Returns the Supabase Auth user id for the current session, or null if
// not signed in. This is NOT the bot's users.id - see getLinkedUserId.
export async function getUserIdFromRequest(): Promise<string | null> {
  const supabase = await getServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user.id
}

// Resolves the current session's linked bot user id (public.users.id), or
// null if this Supabase Auth account hasn't been linked yet via /link.
export async function getLinkedUserId(authUserId: string): Promise<string | null> {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single()

  if (error || !data) {
    return null
  }

  return data.id
}
