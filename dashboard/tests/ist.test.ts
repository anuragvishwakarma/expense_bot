import { istNow, computeAnalytics, getPeriods } from '@/lib/analytics'
import { upcoming } from '@/lib/recurrences'

// 20:00 UTC on 4 Oct is 01:30 IST on 5 Oct: the window where a UTC server is a day behind.
const lateEvening = new Date('2026-10-04T20:00:00Z')

describe('IST handling', () => {
  it('istNow reads IST wall-clock time in its local fields', () => {
    const n = istNow(lateEvening)
    expect([n.getFullYear(), n.getMonth() + 1, n.getDate(), n.getHours(), n.getMinutes()]).toEqual([2026, 10, 5, 1, 30])
    const before = istNow(new Date('2026-10-04T18:29:00Z'))
    expect([before.getDate(), before.getHours()]).toEqual([4, 23])
  })

  it("'this month' includes an entry dated today in IST even though the UTC date is still yesterday", () => {
    const txn = { amount: 100, type: 'expense' as const, date: '2026-10-05', category: 'Food' }
    expect(computeAnalytics([txn], 'this', istNow(lateEvening)).expense).toBe(100)
    expect(getPeriods('this', istNow(lateEvening)).end).toBe('2026-10-05')
  })

  it('rolls into the new month at IST midnight, not UTC midnight', () => {
    const lastNightUTC = new Date('2026-10-31T19:00:00Z') // 00:30 IST on 1 Nov
    expect(getPeriods('this', istNow(lastNightUTC)).start).toBe('2026-11-01')
  })

  it('upcoming recurring treats today as the IST date', () => {
    const row = { amount: 10, description: 'gym', type: 'expense' as const, interval_value: 1, interval_unit: 'week' as const, start_date: '2026-10-05', end_date: null, cron_expression: null, last_run_at: null }
    expect(upcoming([row], lateEvening)[0].date).toBe('2026-10-05')
  })

  it('upcoming cron schedules run on IST time: 09:00 IST daily shows the next IST date', () => {
    const row = { amount: 10, description: 'sip', type: 'expense' as const, interval_value: null, interval_unit: null, start_date: '2026-01-01', end_date: null, cron_expression: '0 9 * * *', last_run_at: null }
    const dates = upcoming([row], lateEvening, 3).map(u => u.date)
    expect(dates[0]).toBe('2026-10-05') // 09:00 IST on the 5th is still ahead of 01:30 IST
    expect(dates).toHaveLength(4)
  })
})
