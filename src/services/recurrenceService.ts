import { checkAmount, checkName } from '../utils/limits';
import { IST_TZ, startOfISTDay } from '../utils/ist';
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
  // start/end are calendar dates in IST: a start of the 10th begins at 00:00 IST, an end date runs to the end of that IST day
  if (now < startOfISTDay(r.start_date)) return false;
  if (r.end_date && now.getTime() >= startOfISTDay(r.end_date).getTime() + DAY_MS) return false;
  const lastRun = r.last_run_at ? new Date(r.last_run_at) : null;
  if (r.cron_expression) {
    try {
      const prev = CronExpressionParser.parse(r.cron_expression, { currentDate: now, tz: IST_TZ }).prev().toDate();
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

// A schedule like "* * * * *" would post an entry every minute, around the clock.
export const MIN_CRON_GAP_MS = 60 * 60 * 1000;
export function assertCronNotTooFrequent(expression: string) {
  const invalid = new Error('That schedule is not valid. Use five fields, for example "0 9 1 * *" for 9am on the 1st of each month.');
  // cron-parser fills in missing fields, so "*" alone would pass as "every minute"; insist on five
  if (expression.trim().split(/\s+/).length !== 5) throw invalid;
  let first: Date, second: Date;
  try {
    const it = CronExpressionParser.parse(expression, { tz: IST_TZ });
    first = it.next().toDate();
    second = it.next().toDate();
  } catch {
    throw invalid;
  }
  if (second.getTime() - first.getTime() < MIN_CRON_GAP_MS) {
    throw new Error('Schedules must be at least an hour apart.');
  }
}

export class RecurrenceService {
  async create(userId: string, amount: number, description: string, type: 'expense' | 'income', intervalValue?: number, intervalUnit?: 'day' | 'week' | 'month', startDate?: string, endDate?: string, cronExpression?: string): Promise<RecurrenceRow> {
    checkAmount(amount, 'amount');
    description = checkName(description, 'recurring entry');
    if (cronExpression) assertCronNotTooFrequent(cronExpression);
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
        // The table requires an interval on every row. Cron rows carry a placeholder: isDue, the
        // worker, the cards and the dashboard all check cron_expression first and ignore it.
        interval_value: cronExpression ? 1 : intervalValue ?? null,
        interval_unit: cronExpression ? 'day' : intervalUnit ?? null,
        start_date: startDate ?? undefined,
        end_date: endDate ?? undefined,
        cron_expression: cronExpression ?? null,
        active: true
      })
      .select()
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

  // Claim this occurrence before creating the transaction. The update only matches while
  // last_run_at still holds the value we read, so when two instances overlap (a rolling deploy)
  // exactly one wins and the other skips. A failed insert afterwards skips one run instead of
  // re-firing every minute.
  async claimRun(rec: { id: string; last_run_at: string | null }, now: Date): Promise<boolean> {
    let query = getSupabase()
      .from('recurrences')
      .update({ last_run_at: now.toISOString() })
      .eq('id', rec.id)
      .eq('active', true);
    query = rec.last_run_at ? query.eq('last_run_at', rec.last_run_at) : query.is('last_run_at', null);
    const { data, error } = await query.select('id');
    if (error) throw error;
    return (data?.length ?? 0) === 1;
  }
}
