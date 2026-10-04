import { fetchAll } from '@/lib/fetchAll'
import { pageHref, parsePage, totalPages, validDate } from '@/lib/pagination'

// A fake table that, like PostgREST, never returns more than `cap` rows per request.
const table = (n: number, cap: number) => {
  const all = Array.from({ length: n }, (_, i) => i)
  const calls: [number, number][] = []
  const page = async (from: number, to: number) => {
    calls.push([from, to])
    return { data: all.slice(from, Math.min(to, from + cap - 1) + 1), error: null, count: n }
  }
  return { page, calls }
}

describe('fetchAll', () => {
  it('returns every row when the table is bigger than one response', async () => {
    const t = table(2500, 1000)
    const r = await fetchAll(t.page)
    expect(r.rows).toHaveLength(2500)
    expect(r.rows[0]).toBe(0)
    expect(r.rows[2499]).toBe(2499)
    expect(r.truncated).toBe(false)
    expect(t.calls).toHaveLength(3)
  })

  it('still gets everything when the server cap is smaller than the page size', async () => {
    const r = await fetchAll(table(1200, 400).page)
    expect(r.rows).toHaveLength(1200)
  })

  it('makes one request for a small table', async () => {
    const t = table(7, 1000)
    expect((await fetchAll(t.page)).rows).toHaveLength(7)
    expect(t.calls).toHaveLength(1)
  })

  it('handles an empty table', async () => {
    expect(await fetchAll(table(0, 1000).page)).toEqual({ rows: [], truncated: false, error: null })
  })

  it('stops at the ceiling and says so', async () => {
    const r = await fetchAll(table(5000, 1000).page, 1000, 3000)
    expect(r.rows).toHaveLength(3000)
    expect(r.truncated).toBe(true)
  })

  it('reports an error instead of returning silently partial data as complete', async () => {
    let n = 0
    const r = await fetchAll(async () => (++n === 2 ? { data: null, error: new Error('boom'), count: null } : { data: Array(1000).fill(0), error: null, count: 3000 }))
    expect(r.error).toBeInstanceOf(Error)
  })
})

describe('pagination helpers', () => {
  it('counts pages', () => {
    expect(totalPages(0)).toBe(1)
    expect(totalPages(50)).toBe(1)
    expect(totalPages(51)).toBe(2)
    expect(totalPages(1200)).toBe(24)
  })
  it('parses page numbers defensively', () => {
    expect(parsePage('3')).toBe(3)
    expect(parsePage('0')).toBe(1)
    expect(parsePage('-4')).toBe(1)
    expect(parsePage('abc')).toBe(1)
    expect(parsePage(undefined)).toBe(1)
  })
  it('accepts only real dates as filters', () => {
    expect(validDate('2026-10-04')).toBe('2026-10-04')
    expect(validDate('garbage')).toBeUndefined()
    expect(validDate("2026-01-01';drop")).toBeUndefined()
    expect(validDate('2026-13-45')).toBeUndefined()
  })
  it('builds links that keep the filters', () => {
    expect(pageHref(1, {})).toBe('/transactions')
    expect(pageHref(3, { startDate: '2026-10-01', endDate: '2026-10-31' })).toBe('/transactions?startDate=2026-10-01&endDate=2026-10-31&page=3')
  })
})
