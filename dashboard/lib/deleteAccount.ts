import type { SupabaseClient } from '@supabase/supabase-js'

// Child tables in dependency order: transactions and budgets point at categories and accounts,
// so they go first. user_reminders has no id column, so every delete is by user_id.
// The bot repeats this list (src/services/accountDeletionService.ts): keep them in sync.
export const USER_TABLES_IN_DELETE_ORDER = [
  'recurrences', // first, so the bot's worker cannot post a new entry mid-delete
  'user_reminders',
  'budgets',
  'goals',
  'debts',
  'transactions',
  'accounts',
  'categories',
] as const

// Deletes a signed-in dashboard user's login and, if it is linked, the whole bot profile behind it.
// ponytail: not one transaction. Every step is idempotent, so a failure midway is fixed by running
// it again; move to a SQL function with ON DELETE CASCADE if this needs to be atomic.
export async function deleteAccount(supabase: SupabaseClient, authUserId: string): Promise<{ profileDeleted: boolean }> {
  const { data: profile, error: findError } = await supabase.from('users').select('id').eq('auth_user_id', authUserId).maybeSingle()
  if (findError) throw new Error(`Could not look up your profile: ${findError.message}`)

  if (profile) {
    for (const table of USER_TABLES_IN_DELETE_ORDER) {
      const { error } = await supabase.from(table).delete().eq('user_id', profile.id)
      if (error) throw new Error(`Could not delete your ${table}: ${error.message}`)
    }
    // The profile points at the login, so detach before deleting it
    const { error: unlinkError } = await supabase.from('users').update({ auth_user_id: null }).eq('id', profile.id)
    if (unlinkError) throw new Error(`Could not detach your login: ${unlinkError.message}`)
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(authUserId)
  if (authError) throw new Error(`Could not delete your login: ${authError.message}`)

  if (profile) {
    const { error: userError } = await supabase.from('users').delete().eq('id', profile.id)
    if (userError) throw new Error(`Could not delete your profile: ${userError.message}`)
  }
  return { profileDeleted: !!profile }
}
