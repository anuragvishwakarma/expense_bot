import Link from 'next/link'
import { pageHref } from '@/lib/pagination'

export default function Pagination({
  page,
  pages,
  total,
  filters,
}: {
  page: number
  pages: number
  total: number
  filters: { startDate?: string; endDate?: string }
}): React.ReactElement {
  const link = 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent/40'
  const off = 'rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground/50'
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        {total.toLocaleString('en-IN')} entries · page {page} of {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 ? <Link href={pageHref(page - 1, filters)} className={link}>‹ Newer</Link> : <span className={off}>‹ Newer</span>}
        {page < pages ? <Link href={pageHref(page + 1, filters)} className={link}>Older ›</Link> : <span className={off}>Older ›</span>}
      </span>
    </div>
  )
}
