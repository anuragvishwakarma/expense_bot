import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserIdFromRequest } from '@/lib/auth'
import TransactionFilters from '@/components/widgets/TransactionFilters'
import TransactionsTable from '@/components/widgets/TransactionsTable'

interface Transaction {
  id: string
  amount: number
  type: 'expense' | 'income'
  date: string
  description: string | null
  category?: { name: string; icon: string } | null
}

async function getTransactionsData(userId: string, searchParams: { startDate?: string; endDate?: string }) {
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

export default async function TransactionsPage({ searchParams }: { searchParams: { startDate?: string; endDate?: string } }) {
  const userId = await getUserIdFromRequest()

  if (!userId) {
    redirect('/login')
  }

  const transactions = await getTransactionsData(userId, searchParams)

  const handleFilterChange = (filters: { startDate: string | null; endDate: string | null }) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    alert('Filtering would reload the page with the selected date range: ' + params.toString())
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transactions</h1>
      <TransactionFilters onChange={handleFilterChange} />
      <TransactionsTable transactions={transactions} />
    </div>
  )
}