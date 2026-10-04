import { computeAnalytics, getPeriods } from '@/lib/analytics'

const now = new Date(2026, 9, 10) // 10 Oct 2026
const t = (date: string, amount: number, type: 'income' | 'expense' = 'expense', category = 'Food') =>
  ({ date, amount, type, category })

describe('analytics', () => {
  it('compares this month against same elapsed days of last month', () => {
    expect(getPeriods('this', now)).toEqual({
      start: '2026-10-01', end: '2026-10-10', prevStart: '2026-09-01', prevEnd: '2026-09-10',
    })
  })

  it('computes totals, deltas, categories, projection', () => {
    const r = computeAnalytics(
      [t('2026-10-02', 100), t('2026-10-05', 50, 'expense', 'Travel'), t('2026-10-03', 1000, 'income'),
       t('2026-09-05', 100), t('2026-09-20', 999)], // 20 Sep outside prev window
      'this', now)
    expect(r.expense).toBe(150)
    expect(r.savingsRate).toBeCloseTo(85)
    expect(r.expenseDelta).toBeCloseTo(50)
    expect(r.categories[0]).toEqual({ name: 'Food', value: 100 })
    expect(r.projected).toBeCloseTo(465) // 150/10*31
    expect(r.trend[9].current).toBe(150)
    expect(r.trend).toHaveLength(10)
  })
})

describe('insights', () => {
  it('finds spikes, merchants, weekday, largest', () => {
    const r = computeAnalytics(
      [{ ...t('2026-10-05', 300, 'expense', 'Food'), description: 'Swiggy' }, // Mon 5 Oct
       { ...t('2026-10-06', 100, 'expense', 'Food'), description: 'swiggy ' },
       t('2026-09-05', 100, 'expense', 'Food')],
      'this', now)
    expect(r.spikes[0].name).toBe('Food')
    expect(r.topMerchants[0]).toEqual({ name: 'Swiggy', total: 400, count: 2 })
    expect(r.weekday[0].total).toBe(300)
    expect(r.largest[0].amount).toBe(300)
  })
})
