export type RangeKey = 'this' | 'last' | '3m' | '6m' | 'ytd'

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'this', label: 'This month' },
  { key: 'last', label: 'Last month' },
  { key: '3m', label: '3 months' },
  { key: '6m', label: '6 months' },
  { key: 'ytd', label: 'Year to date' },
]

export interface Txn {
  amount: number | string
  type: 'income' | 'expense'
  date: string // YYYY-MM-DD
  category: string
  description?: string | null
}

// Local YYYY-MM-DD; toISOString() would shift the day across timezones.
export const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const DAY = 86400000
const parse = (s: string) => new Date(`${s}T00:00:00`)
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY)

export function parseRange(v?: string): RangeKey {
  return RANGES.some(r => r.key === v) ? (v as RangeKey) : 'this'
}

// Inclusive [start, end] plus the comparison window right before it.
export function getPeriods(range: RangeKey, now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth()
  let start: Date, end: Date, prevStart: Date, prevEnd: Date
  if (range === 'this' || range === 'last') {
    const base = range === 'this' ? m : m - 1
    start = new Date(y, base, 1)
    end = range === 'this' ? now : new Date(y, base + 1, 0)
    prevStart = new Date(y, base - 1, 1)
    // Same elapsed days of previous month so mid-month deltas are fair.
    const prevLast = new Date(y, base, 0).getDate()
    prevEnd = new Date(y, base - 1, Math.min(end.getDate(), prevLast))
  } else {
    start = range === 'ytd' ? new Date(y, 0, 1) : new Date(y, m - (range === '3m' ? 2 : 5), 1)
    end = now
    const len = Math.round((end.getTime() - start.getTime()) / DAY) + 1
    prevEnd = new Date(start.getTime() - DAY)
    prevStart = new Date(prevEnd.getTime() - (len - 1) * DAY)
  }
  return { start: fmt(start), end: fmt(end), prevStart: fmt(prevStart), prevEnd: fmt(prevEnd) }
}

const sum = (t: Txn[], type: Txn['type']) =>
  t.filter(x => x.type === type).reduce((s, x) => s + Number(x.amount), 0)

// Cumulative expense by day index; null past `today` so the line stops.
function cumulative(txns: Txn[], start: string, days: number, cutoff: number) {
  const perDay = new Array(days).fill(0)
  for (const t of txns) {
    if (t.type !== 'expense') continue
    const i = daysBetween(start, t.date)
    if (i >= 0 && i < days) perDay[i] += Number(t.amount)
  }
  let run = 0
  return perDay.map((v, i) => (run += v, i < cutoff ? run : null))
}

export function computeAnalytics(txns: Txn[], range: RangeKey, now = new Date()) {
  const p = getPeriods(range, now)
  const inRange = (t: Txn, a: string, b: string) => t.date >= a && t.date <= b
  const cur = txns.filter(t => inRange(t, p.start, p.end))
  const prev = txns.filter(t => inRange(t, p.prevStart, p.prevEnd))

  const income = sum(cur, 'income')
  const expense = sum(cur, 'expense')
  const prevIncome = sum(prev, 'income')
  const prevExpense = sum(prev, 'expense')
  const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null)

  const byCategory = (list: Txn[]) => {
    const m = new Map<string, number>()
    for (const t of list) {
      if (t.type === 'expense') m.set(t.category, (m.get(t.category) ?? 0) + Number(t.amount))
    }
    return m
  }
  const byCat = byCategory(cur)
  const prevByCat = byCategory(prev)
  const categories = [...byCat].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  // Spikes: category spend more than doubled vs the comparison window.
  const spikes = categories
    .filter(c => (prevByCat.get(c.name) ?? 0) > 0 && c.value > 2 * prevByCat.get(c.name)!)
    .map(c => ({ ...c, pct: (c.value / prevByCat.get(c.name)! - 1) * 100 }))

  const expenses = cur.filter(t => t.type === 'expense')
  const merchants = new Map<string, { name: string; total: number; count: number }>()
  for (const t of expenses) {
    const label = t.description?.trim()
    if (!label) continue
    const key = label.toLowerCase()
    const m = merchants.get(key) ?? { name: label, total: 0, count: 0 }
    m.total += Number(t.amount)
    m.count++
    merchants.set(key, m)
  }
  const topMerchants = [...merchants.values()].sort((a, b) => b.total - a.total).slice(0, 5)
  const largest = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5)

  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({ day, total: 0 }))
  for (const t of expenses) weekday[(parse(t.date).getDay() + 6) % 7].total += Number(t.amount)

  const days = daysBetween(p.start, p.end) + 1
  const elapsed = daysBetween(p.start, fmt(now)) + 1
  const cutoff = Math.min(days, Math.max(elapsed, 0))
  const prevDays = daysBetween(p.prevStart, p.prevEnd) + 1
  const curLine = cumulative(cur, p.start, days, cutoff)
  const prevLine = cumulative(prev, p.prevStart, prevDays, prevDays)
  const trend = Array.from({ length: Math.max(days, prevDays) }, (_, i) => ({
    day: i + 1,
    current: curLine[i] ?? null,
    previous: prevLine[i] ?? null,
  }))

  // Projection only makes sense while the current month is still running.
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const projected = range === 'this' && elapsed > 0 ? (expense / elapsed) * dim : null

  return {
    income,
    expense,
    net: income - expense,
    savingsRate: income > 0 ? ((income - expense) / income) * 100 : null,
    expenseDelta: pct(expense, prevExpense),
    incomeDelta: pct(income, prevIncome),
    categories,
    spikes,
    topMerchants,
    largest,
    weekday,
    trend,
    projected,
  }
}

// Month-by-month series for the existing bar chart; always last 6 months.
export function monthlySeries(txns: Txn[], now = new Date()) {
  return Array.from({ length: 6 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1)
    const prefix = fmt(d).slice(0, 7)
    const m = txns.filter(t => t.date.startsWith(prefix))
    return { month: d.toLocaleString('default', { month: 'short' }), income: sum(m, 'income'), expense: sum(m, 'expense') }
  })
}

// Last 6 months stacked by category: top 5 overall + "Other".
export function categoryTrend(txns: Txn[], now = new Date()) {
  const months = Array.from({ length: 6 }, (_, k) => new Date(now.getFullYear(), now.getMonth() - (5 - k), 1))
  const prefixes = months.map(d => fmt(d).slice(0, 7))
  const exp = txns.filter(t => t.type === 'expense' && prefixes.includes(t.date.slice(0, 7)))
  const totals = new Map<string, number>()
  for (const t of exp) totals.set(t.category, (totals.get(t.category) ?? 0) + Number(t.amount))
  const top = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name)
  const hasOther = totals.size > top.length
  const keys = hasOther ? [...top, 'Other'] : top
  const data = months.map((d, i) => {
    const row: Record<string, number | string> = { month: d.toLocaleString('default', { month: 'short' }) }
    for (const k of keys) row[k] = 0
    for (const t of exp) {
      if (!t.date.startsWith(prefixes[i])) continue
      const k = top.includes(t.category) ? t.category : 'Other'
      row[k] = (row[k] as number) + Number(t.amount)
    }
    return row
  })
  return { keys, data }
}
