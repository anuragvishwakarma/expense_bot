import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase'
import { getUserIdFromRequest, getLinkedUserId } from '@/lib/auth'
import TransactionFilters from '@/components/widgets/TransactionFilters'
import TransactionsTable from '@/components/widgets/TransactionsTable'
import NotLinked from '@/components/not-linked'

export const dynamic = 'force-dynamic'

interface Transaction {
  id: string
  amount: number
  type: 'expense' | 'income'
  date: string
  description: string | null
  category?: { name: string; icon: string } | null
}

async function getTransactionsData(userId: string, searchParams: { startDate?: string; endDate?: string }) {
  const supabase = await getServerSupabase()
  let queryBuilder = supabase
    .from('transactions')
    .select(`
      *,
      category:categories(name, icon)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (searchParams.startDate) {
    queryBuilder = queryBuilder.gte('date', searchParams.startDate)
  }
  if (searchParams.endDate) {
    queryBuilder = queryBuilder.lte('date', searchParams.endDate)
  }

  const { data: transactions, error } = await queryBuilder

  if (error) {
    console.error('Error fetching transactions:', error)
    return []
  }

  return (transactions as Transaction[]) || []
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>
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

  const transactions = await getTransactionsData(userId, await searchParams)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Transactions</h1>
      <Suspense fallback={null}>
        <TransactionFilters />
      </Suspense>
      <TransactionsTable transactions={transactions} />
    </div>
  )
}