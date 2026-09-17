import { getSupabase } from '../db';

interface RecurrenceRow {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  type: 'expense' | 'income';
  interval_value: number | null;
  interval_unit: 'day' | 'week' | 'month' | null;
  start_date: string;
  end_date: string | null;
  cron_expression: string | null;
  active: boolean;
  created_at: string;
}

export class RecurrenceService {
  async create(userId: string, amount: number, description: string, type: 'expense' | 'income', intervalValue?: number, intervalUnit?: 'day' | 'week' | 'month', startDate?: string, endDate?: string, cronExpression?: string): Promise<RecurrenceRow> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurrences')
      .insert({
        user_id: userId,
        amount,
        description,
        type,
        interval_value: intervalValue ?? null,
        interval_unit: intervalUnit ?? null,
        start_date: startDate ?? undefined,
        end_date: endDate ?? undefined,
        cron_expression: cronExpression ?? null,
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

  // Returns recurrences that should fire now (based on cron expression or simple interval)
  async getDueRecurrences(now: Date) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurrences')
      .select('*')
      .eq('active', true);
    if (error) throw error;
    const due: any[] = [];
    const cron = require('cron-parser');
    for (const r of data ?? []) {
      let isDue = false;
      if (r.cron_expression) {
        try {
          const interval = cron.parseExpression(r.cron_expression, { currentDate: now });
          isDue = interval.isValid();
        } catch (e) {
          // If cron expression invalid, fallback to interval logic
          console.warn(`Invalid cron expression for recurrence ${r.id}: ${r.cron_expression}`);
        }
      } else if (r.interval_value && r.interval_unit) {
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
          isDue = true;
        }
      }
      if (isDue) {
        due.push(r);
      }
    }
    return due;
  }
}