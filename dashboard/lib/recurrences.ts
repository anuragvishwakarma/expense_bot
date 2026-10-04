import { CronExpressionParser } from 'cron-parser'
import { IST } from './analytics'

export interface RecurrenceRow {
  amount: number | string
  description: string
  type: 'income' | 'expense'
  interval_value: number | null
  interval_unit: 'day' | 'week' | 'month' | null
  start_date: string
  end_date: string | null
  cron_expression: string | null
  last_run_at: string | null
}

export interface Upcoming { date: string; description: string; amount: number; type: 'income' | 'expense' }

const DAY = 86400000
const MAX_PER_RECURRENCE = 60 // guards against per-minute crons

// Calendar dates follow IST, like the bot's worker. Day arithmetic is done on UTC-midnight
// Dates that stand for calendar days; instants (now, last_run_at, cron hits) convert via istDay.
const istDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: IST })
const calendarDay = (s: string) => new Date(`${s}T00:00:00Z`)
const label = (d: Date) => d.toISOString().slice(0, 10)

function step(d: Date, value: number, unit: 'day' | 'week' | 'month') {
  const n = new Date(d)
  if (unit === 'month') n.setUTCMonth(n.getUTCMonth() + value)
  else n.setUTCDate(n.getUTCDate() + value * (unit === 'week' ? 7 : 1))
  return n
}

// Occurrences from today through today + days (IST), mirroring the bot worker (overdue fires today).
export function upcoming(rows: RecurrenceRow[], now = new Date(), days = 30): Upcoming[] {
  const today = calendarDay(istDay(now))
  const horizon = new Date(today.getTime() + days * DAY)
  const horizonStr = label(horizon)
  const out: Upcoming[] = []
  for (const r of rows) {
    const push = (dateStr: string) => {
      if (dateStr <= horizonStr && (!r.end_date || dateStr <= r.end_date)) {
        out.push({ date: dateStr, description: r.description, amount: Number(r.amount), type: r.type })
      }
    }
    if (r.cron_expression) {
      try {
        const it = CronExpressionParser.parse(r.cron_expression, {
          currentDate: now,
          endDate: new Date(horizon.getTime() + DAY), // generous; push() trims by IST date
          tz: IST,
        })
        for (let i = 0; i < MAX_PER_RECURRENCE && it.hasNext(); i++) push(istDay(it.next().toDate()))
      } catch {
        // invalid cron: bot skips it too
      }
      continue
    }
    if (!r.interval_value || !r.interval_unit) continue
    let next = r.last_run_at ? step(calendarDay(istDay(new Date(r.last_run_at))), r.interval_value, r.interval_unit) : calendarDay(r.start_date)
    if (next < today) next = today
    for (let i = 0; i < MAX_PER_RECURRENCE && label(next) <= horizonStr; i++) {
      push(label(next))
      next = step(next, r.interval_value, r.interval_unit)
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
