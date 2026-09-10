import { getSupabase } from '../db';

export class RecurrenceService {
  async create(userId: string, amount: number, description: string, type: 'expense' | 'income', intervalValue: number, intervalUnit: 'day' | 'week' | 'month', startDate?: string, endDate?: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurrences')
      .insert({
        user_id: userId,
        amount,
        description,
        type,
        interval_value: intervalValue,
        interval_unit: intervalUnit,
        start_date: startDate ?? undefined,
        end_date: endDate ?? undefined,
        active: true
      })
      .single();
    if (error) throw error;
    return data;
  }

  async listActive(userId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurrences')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true);
    if (error) throw error;
    return data ?? [];
  }

  async deactivate(id: string, userId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurrences')
      .update({ active: false })
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  // Returns recurrences that should fire now (based on simple interval from start_date)
  async getDueRecurrences(now: Date) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurrences')
      .select('*')
      .eq('active', true);
    if (error) throw error;
    const due: any[] = [];
    for (const r of data ?? []) {
      const start = new Date(r.start_date);
      const diffTime = now.getTime() - start.getTime();
      let diffUnits = 0;
      if (r.interval_unit === 'day') {
        diffUnits = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      } else if (r.interval_unit === 'week') {
        diffUnits = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
      } else if (r.interval_unit === 'month') {
        // Approximate month as 30 days
        diffUnits = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
      }
      if (diffUnits % r.interval_value === 0) {
        due.push(r);
      }
    }
    return due;
  }
}