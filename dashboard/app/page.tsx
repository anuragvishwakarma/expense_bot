import type { NextPage } from 'next'
import SummaryCards from '@/components/widgets/SummaryCards'
import IncomeExpenseChart from '@/components/widgets/IncomeExpenseChart'
import GoalsProgress from '@/components/widgets/GoalsProgress'
import { supabase } from '@/lib/supabase'

export const getServerSideProps = async () => {
  // Fetch transactions for the current month (for summary) and last 6 months (for chart)
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1) // inclusive start

  // We'll fetch all transactions from sixMonthsAgo to now and then filter in memory for simplicity
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('amount, type, date')
    .gte('date', sixMonthsAgo.toISOString())
    .lte('date', now.toISOString())

  if (error) {
    console.error('Error fetching transactions:', error)
    return { props: { totalIncome: 0, totalExpense: 0, net: 0, monthlyData: [], goals: [] } }
  }

  // Filter for current month
  const currentMonthTransactions = transactions.filter(t => {
    const date = new Date(t.date)
    return date >= startOfMonth && date <= endOfMonth
  })

  const totalIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const totalExpense = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const net = totalIncome - totalExpense

  // Prepare monthly data for the chart (last 6 months, including current)
  const monthlyData = []
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const monthName = monthDate.toLocaleString('default', { month: 'short' })
    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.date)
      return date >= monthDate && date <= monthEnd
    })
    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const expense = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    monthlyData.push({ month: monthName, income, expense })
  }

  // Placeholder goals
  const goals = [
    { name: 'Emergency Fund', target: 100000, saved: 25000 },
    { name: 'Vacation', target: 50000, saved: 10000 },
  ]

  return {
    props: {
      totalIncome,
      totalExpense,
      net,
      monthlyData,
      goals,
    }
  }
}

const OverviewPage: NextPage = ({
  totalIncome,
  totalExpense,
  net,
  monthlyData,
  goals,
}) => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Overview</h1>
      <SummaryCards
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        net={net}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <IncomeExpenseChart data={monthlyData} />
        <GoalsProgress goals={goals} />
      </div>
    </div>
  )
}

export default OverviewPage