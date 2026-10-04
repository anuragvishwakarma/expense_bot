import { getSupabase } from '../db';

// Child tables in dependency order: transactions and budgets point at categories and accounts,
// so they go first; the user row goes last. user_reminders has no id column, so every delete is
// by user_id. The dashboard repeats this list (dashboard/lib/deleteAccount.ts): keep them in sync.
export const USER_TABLES_IN_DELETE_ORDER = [
  'recurrences', // first, so the worker cannot post a new entry mid-delete
  'user_reminders',
  'budgets',
  'goals',
  'debts',
  'transactions',
  'accounts',
  'categories',
] as const;

export class AccountDeletionService {
  // Permanently deletes everything for a bot user, and the dashboard login if one is linked.
  // ponytail: not one transaction. Every step is idempotent, so a failure midway is fixed by
  // running it again; move to a SQL function with ON DELETE CASCADE if this needs to be atomic.
  async deleteEverything(userId: string): Promise<{ loginDeleted: boolean }> {
    const supabase = getSupabase();

    const { data: user, error: findError } = await supabase.from('users').select('auth_user_id').eq('id', userId).single();
    if (findError || !user) throw new Error('Profile not found.');

    for (const table of USER_TABLES_IN_DELETE_ORDER) {
      const { error } = await supabase.from(table).delete().eq('user_id', userId);
      if (error) throw new Error(`Could not delete your ${table}: ${error.message}`);
    }

    let loginDeleted = false;
    if (user.auth_user_id) {
      // The profile points at the login, so detach before deleting it
      const { error: unlinkError } = await supabase.from('users').update({ auth_user_id: null }).eq('id', userId);
      if (unlinkError) throw new Error(`Could not detach the dashboard login: ${unlinkError.message}`);
      const { error: authError } = await supabase.auth.admin.deleteUser(user.auth_user_id);
      if (authError) throw new Error(`Could not delete the dashboard login: ${authError.message}`);
      loginDeleted = true;
    }

    const { error: userError } = await supabase.from('users').delete().eq('id', userId);
    if (userError) throw new Error(`Could not delete your profile: ${userError.message}`);
    return { loginDeleted };
  }
}
