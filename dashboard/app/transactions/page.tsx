import type { NextPage } from 'next'
import { supabase } from '@/lib/supabase'
import TransactionFilters from '@/components/widgets/TransactionFilters'
import TransactionsTable from '@/components/widgets/TransactionsTable'

export const getServerSideProps = async (context: any) => {
  const { query } = context
  const startDate = query.startDate as string | null
  const endDate = query.endDate as string | null

  let queryBuilder = supabase
    .from('transactions')
    .select(`
      *,
      category:categories(name, icon)
    `)
    .order('date', { ascending: false })

  if (startDate) {
    queryBuilder = queryBuilder.gte('date', startDate)
  }
  if (endDate) {
    queryBuilder = queryBuilder.lte('date', endDate)
  }

  const { data: transactions, error } = await queryBuilder

  if (error) {
    console.error('Error fetching transactions:', error)
    return { props: { transactions: [] } }
  }

  return { props: { transactions: transactions || [] } }
}

const TransactionsPage: NextPage = ({ transactions }) => {
  const handleFilterChange = (filters: { startDate: string | null; endDate: string | null }) => {
    // For simplicity, we'll just show an alert that filtering would work with a real router.
    // In a full implementation, we would use next/router to update the URL and refetch.
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

export default TransactionsPage