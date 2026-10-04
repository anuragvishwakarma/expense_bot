import { upcoming } from '@/lib/recurrences'

const now = new Date('2026-10-10T08:00:00Z')
const base = { amount: 100, description: 'Rent', type: 'expense' as const, interval_value: null, interval_unit: null, start_date: '2026-01-01', end_date: null, cron_expression: null, last_run_at: null }

describe('upcoming', () => {
  it('steps interval recurrences from last run', () => {
    const r = upcoming([{ ...base, interval_value: 1, interval_unit: 'week', last_run_at: '2026-10-08T00:00:00Z' }], now)
    expect(r.map(x => x.date)).toEqual(['2026-10-15', '2026-10-22', '2026-10-29', '2026-11-05'])
  })
  it('treats overdue as today and respects end_date', () => {
    const r = upcoming([{ ...base, interval_value: 1, interval_unit: 'day', last_run_at: '2026-09-01T00:00:00Z', end_date: '2026-10-11' }], now)
    expect(r.map(x => x.date)).toEqual(['2026-10-10', '2026-10-11'])
  })
  it('expands cron expressions', () => {
    const r = upcoming([{ ...base, cron_expression: '0 9 1 * *' }], now)
    expect(r.map(x => x.date)).toEqual(['2026-11-01'])
  })
})
