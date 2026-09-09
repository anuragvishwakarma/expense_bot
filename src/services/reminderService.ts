import { getSupabase } from '../db';

export class ReminderService {
  async getPreference(userId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('user_reminders')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = 0 rows
    return data ?? null;
  }

  async setPreference(userId: string, enabled: boolean, time: string = '21:00:00') {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('user_reminders')
      .upsert(
        { user_id: userId, enabled, reminder_time: time, updated_at: new Date().toISOString() },
        { onConflict: ['user_id'] }
      )
      .single();
    if (error) throw error;
    return data;
  }
}