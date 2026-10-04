export const TX_PAGE_SIZE = 50

export const totalPages = (total: number, size = TX_PAGE_SIZE) => Math.max(1, Math.ceil(total / size))

export const parsePage = (v?: string) => {
  const n = parseInt(v ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

// Only real YYYY-MM-DD dates become filters; anything else is ignored instead of erroring in SQL.
export const validDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? v : undefined)

export function pageHref(page: number, filters: { startDate?: string; endDate?: string }) {
  const p = new URLSearchParams()
  if (filters.startDate) p.set('startDate', filters.startDate)
  if (filters.endDate) p.set('endDate', filters.endDate)
  if (page > 1) p.set('page', String(page))
  const q = p.toString()
  return q ? `/transactions?${q}` : '/transactions'
}
