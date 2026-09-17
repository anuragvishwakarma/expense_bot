import { redirect } from 'next/navigation'
import SummaryCards from '@/components/widgets/SummaryCards'
import IncomeExpenseChart from '@/components/widgets/IncomeExpenseChart'
import GoalsProgress from '@/components/widgets/GoalsProgress'
import { supabase } from '@/lib/supabase'
import { getUserIdFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getDashboardData(userId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [transactionsResp, goalsResp] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, type, date')
      .eq('user_id', userId)
      .gte('date', sixMonthsAgo.toISOString())
      .lte('date', now.toISOString()),
    supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
  ])

  if (transactionsResp.error) {
    console.error('Error fetching transactions:', transactionsResp.error)
    return { totalIncome: 0, totalExpense: 0, net: 0, monthlyData: [], goals: [] }
  }
  if (goalsResp.error) {
    console.error('Error fetching goals:', goalsResp.error)
    return { totalIncome: 0, totalExpense: 0, net: 0, monthlyData: [], goals: [] }
  }

  const transactions = transactionsResp.data || []
  const goals = goalsResp.data || []

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

  const goalsForChart = goals.map(g => ({
    name: g.name,
    target: Number(g.target_amount),
    saved: Number(g.saved_amount)
  }))

  return { totalIncome, totalExpense, net, monthlyData, goals: goalsForChart }
}

export default async function OverviewPage() {
  const userId = await getUserIdFromRequest()

  if (!userId) {
    redirect('/login')
  }

  const { totalIncome, totalExpense, net, monthlyData, goals } = await getDashboardData(userId)

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