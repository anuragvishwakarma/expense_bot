import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase'
import { getUserIdFromRequest, getLinkedUserId } from '@/lib/auth'
import TransactionFilters from '@/components/widgets/TransactionFilters'
import TransactionsTable from '@/components/widgets/TransactionsTable'
import NotLinked from '@/components/not-linked'
import Pagination from '@/components/widgets/Pagination'
import { TX_PAGE_SIZE, pageHref, parsePage, totalPages, validDate } from '@/lib/pagination'

export const dynamic = 'force-dynamic'

interface Transaction {
  id: string
  amount: number
  type: 'expense' | 'income'
  date: string
  description: string | null
  category?: { name: string; icon: string } | null
}

async function getTransactionsData(
  userId: string,
  filters: { startDate?: string; endDate?: string },
  page: number
): Promise<{ transactions: Transaction[]; total: number }> {
  const supabase = await getServerSupabase()
  let queryBuilder = supabase
    .from('transactions')
    .select(
      `
      *,
      category:categories(name, icon)
    `,
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('id')
    .range((page - 1) * TX_PAGE_SIZE, page * TX_PAGE_SIZE - 1)

  if (filters.startDate) queryBuilder = queryBuilder.gte('date', filters.startDate)
  if (filters.endDate) queryBuilder = queryBuilder.lte('date', filters.endDate)

  const { data: transactions, count, error } = await queryBuilder

  // PostgREST answers an out-of-range page with PGRST103; read the total from page 1 so the
  // caller can send the user to the real last page.
  if (error?.code === 'PGRST103' && page > 1) {
    const first = await getTransactionsData(userId, filters, 1)
    return { transactions: [] as Transaction[], total: first.total }
  }
  if (error) {
    console.error('Error fetching transactions:', error)
    return { transactions: [] as Transaction[], total: 0 }
  }

  return { transactions: (transactions as Transaction[]) || [], total: count ?? 0 }
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string; page?: string }>
}) {
  const authUserId = await getUserIdFromRequest()

  if (!authUserId) {
    redirect('/login')
  }

  const userId = await getLinkedUserId(authUserId)

  if (!userId) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Transactions</h1>
        <NotLinked />
      </div>
    )
  }

  const sp = await searchParams
  const filters = { startDate: validDate(sp.startDate), endDate: validDate(sp.endDate) }
  const requested = parsePage(sp.page)
  const { transactions, total } = await getTransactionsData(userId, filters, requested)
  const pages = totalPages(total)
  // A stale link past the last page lands on the last page instead of an empty table
  if (requested > pages) redirect(pageHref(pages, filters))

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Transactions</h1>
      <Suspense fallback={null}>
        <TransactionFilters />
      </Suspense>
      <TransactionsTable transactions={transactions} />
      <Pagination page={requested} pages={pages} total={total} filters={filters} />
    </div>
  )
}