// PostgREST silently caps every response at its max_rows (1000 on Supabase). To total a whole
// period we page with .range() until we have as many rows as the first response's exact count.
export const PAGE_SIZE = 1000
export const MAX_ROWS = 20_000 // safety ceiling; beyond this the page says the data is truncated

type PageResult<T> = { data: T[] | null; error: unknown; count: number | null }

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = PAGE_SIZE,
  maxRows = MAX_ROWS
): Promise<{ rows: T[]; truncated: boolean; error: unknown }> {
  const rows: T[] = []
  let total = Infinity
  while (rows.length < Math.min(total, maxRows)) {
    const { data, error, count } = await page(rows.length, rows.length + pageSize - 1)
    if (error) return { rows, truncated: false, error }
    if (count !== null) total = count
    if (!data || data.length === 0) break
    rows.push(...data)
  }
  return { rows, truncated: rows.length < total && rows.length >= maxRows, error: null }
}
