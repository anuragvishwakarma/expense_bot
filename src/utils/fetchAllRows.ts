// PostgREST silently caps each response at max_rows (1000 on Supabase). Reports and the CSV backup
// must see every row, so page with .range() until we hold what the exact count promises.
// ponytail: ceiling below, a user with more rows gets an error rather than a silently short result.
const PAGE = 1000;
const MAX_ROWS = 100_000;
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown; count: number | null }>
): Promise<T[]> {
  const all: T[] = [];
  let total = Infinity;
  while (all.length < total) {
    const { data, error, count } = await page(all.length, all.length + PAGE - 1);
    if (error) throw error;
    if (count != null) total = count;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (count == null && data.length < PAGE) break;
    if (all.length >= MAX_ROWS && all.length < total) {
      throw new Error('That is too many entries for one report. Try a shorter date range.');
    }
  }
  return all;
}
