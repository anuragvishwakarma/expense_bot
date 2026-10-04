import { CronExpressionParser } from 'cron-parser'

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
const day = (d: Date) => d.toISOString().slice(0, 10)

function step(d: Date, value: number, unit: 'day' | 'week' | 'month') {
  const n = new Date(d)
  if (unit === 'month') n.setUTCMonth(n.getUTCMonth() + value)
  else n.setUTCDate(n.getUTCDate() + value * (unit === 'week' ? 7 : 1))
  return n
}

// Occurrences in [today, today + days], mirroring the bot worker (UTC, overdue fires today).
export function upcoming(rows: RecurrenceRow[], now = new Date(), days = 30): Upcoming[] {
  const today = new Date(`${day(now)}T00:00:00Z`)
  const horizon = new Date(today.getTime() + days * DAY)
  const out: Upcoming[] = []
  for (const r of rows) {
    const endCap = r.end_date ? new Date(`${r.end_date}T00:00:00Z`) : null
    const push = (d: Date) => {
      if (d <= horizon && (!endCap || d <= endCap)) out.push({ date: day(d), description: r.description, amount: Number(r.amount), type: r.type })
    }
    if (r.cron_expression) {
      try {
        const it = CronExpressionParser.parse(r.cron_expression, { currentDate: today, endDate: horizon, tz: 'UTC' })
        for (let i = 0; i < MAX_PER_RECURRENCE && it.hasNext(); i++) push(it.next().toDate())
      } catch {
        // invalid cron: bot skips it too
      }
      continue
    }
    if (!r.interval_value || !r.interval_unit) continue
    const start = new Date(`${r.start_date}T00:00:00Z`)
    let next = r.last_run_at ? step(new Date(r.last_run_at), r.interval_value, r.interval_unit) : start
    if (next < today) next = today
    for (let i = 0; i < MAX_PER_RECURRENCE && next <= horizon; i++) {
      push(next)
      next = step(next, r.interval_value, r.interval_unit)
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
