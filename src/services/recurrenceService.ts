import { CronExpressionParser } from 'cron-parser';
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
  last_run_at: string | null;
  created_at: string;
}

const MAX_ACTIVE_PER_USER = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

// Due if the schedule has an occurrence after the last run, inside start/end dates.
export function isDue(r: RecurrenceRow, now: Date): boolean {
  const start = new Date(r.start_date);
  if (now < start) return false;
  if (r.end_date && now.getTime() >= new Date(r.end_date).getTime() + DAY_MS) return false;
  const lastRun = r.last_run_at ? new Date(r.last_run_at) : null;
  if (r.cron_expression) {
    try {
      const prev = CronExpressionParser.parse(r.cron_expression, { currentDate: now, tz: 'UTC' }).prev().toDate();
      return prev > (lastRun ?? new Date(r.created_at));
    } catch (e) {
      console.warn(`Invalid cron expression for recurrence ${r.id}: ${r.cron_expression}`);
      return false;
    }
  }
  if (!r.interval_value || !r.interval_unit) return false;
  if (!lastRun) return true; // first run on/after start_date
  const next = new Date(lastRun);
  if (r.interval_unit === 'month') next.setUTCMonth(next.getUTCMonth() + r.interval_value);
  else next.setUTCDate(next.getUTCDate() + r.interval_value * (r.interval_unit === 'week' ? 7 : 1));
  return now >= next;
}

export class RecurrenceService {
  async create(userId: string, amount: number, description: string, type: 'expense' | 'income', intervalValue?: number, intervalUnit?: 'day' | 'week' | 'month', startDate?: string, endDate?: string, cronExpression?: string): Promise<RecurrenceRow> {
    if ((await this.listActive(userId)).length >= MAX_ACTIVE_PER_USER) {
      throw new Error(`Max ${MAX_ACTIVE_PER_USER} active recurrences per user`);
    }
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
    const due = (data ?? []).filter((r: RecurrenceRow) => isDue(r, now));
    return due;
  }

  // Stamp before creating the transaction: a failed insert skips one run instead of re-firing every minute
  async markRun(id: string, now: Date) {
    const { error } = await getSupabase().from('recurrences').update({ last_run_at: now.toISOString() }).eq('id', id);
    if (error) throw error;
  }
}
