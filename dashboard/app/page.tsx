import { redirect } from 'next/navigation'
import SummaryCards from '@/components/widgets/SummaryCards'
import IncomeExpenseChart from '@/components/widgets/IncomeExpenseChart'
import GoalsProgress from '@/components/widgets/GoalsProgress'
import CategoryDonut from '@/components/widgets/CategoryDonut'
import SpendTrend from '@/components/widgets/SpendTrend'
import BudgetProgress from '@/components/widgets/BudgetProgress'
import WeekdayChart from '@/components/widgets/WeekdayChart'
import TopSpends from '@/components/widgets/TopSpends'
import CategoryTrend from '@/components/widgets/CategoryTrend'
import UpcomingRecurring from '@/components/widgets/UpcomingRecurring'
import RangePicker from '@/components/widgets/RangePicker'
import GetStarted from '@/components/get-started'
import { NOT_LINKED, getOnboardingState, isComplete } from '@/lib/onboarding'
import { getServerSupabase } from '@/lib/supabase'
import { getUserIdFromRequest, getLinkedUserId } from '@/lib/auth'
import { upcoming } from '@/lib/recurrences'
import { RANGES, categoryTrend, computeAnalytics, getPeriods, monthlySeries, parseRange, fmt, type RangeKey, type Txn } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

async function getDashboardData(userId: string, range: RangeKey) {
  const supabase = await getServerSupabase()
  const now = new Date()
  // Cover the 6-month bar chart, the selected range, and its comparison window.
  const from = [fmt(new Date(now.getFullYear(), now.getMonth() - 5, 1)), getPeriods(range, now).prevStart].sort()[0]

  const [txResp, goalsResp, budgetsResp, recResp] = await Promise.all([
    // ponytail: PostgREST caps at 1000 rows; move aggregation to SQL/RPC if users exceed that in the window
    supabase
      .from('transactions')
      .select('amount, type, date, description, categories(name)')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', fmt(now)),
    supabase.from('goals').select('*').eq('user_id', userId),
    supabase
      .from('budgets')
      .select('amount, categories(name)')
      .eq('user_id', userId)
      .eq('month', now.getMonth() + 1)
      .eq('year', now.getFullYear()),
    supabase.from('recurrences').select('*').eq('user_id', userId).eq('active', true),
  ])

  if (txResp.error) console.error('Error fetching transactions:', txResp.error)
  if (goalsResp.error) console.error('Error fetching goals:', goalsResp.error)
  if (budgetsResp.error) console.error('Error fetching budgets:', budgetsResp.error)
  if (recResp.error) console.error('Error fetching recurrences:', recResp.error)

  const catName = (c: unknown) => (Array.isArray(c) ? c[0]?.name : (c as { name?: string } | null)?.name) ?? 'Uncategorized'
  const txns: Txn[] = (txResp.data ?? []).map(t => ({
    amount: t.amount,
    type: t.type,
    date: t.date,
    category: catName(t.categories),
    description: t.description,
  }))

  const analytics = computeAnalytics(txns, range, now)
  const spentThisMonth = new Map(computeAnalytics(txns, 'this', now).categories.map(c => [c.name, c.value]))
  const budgets = (budgetsResp.data ?? []).map(b => {
    const name = catName(b.categories)
    return { name, budget: Number(b.amount), spent: spentThisMonth.get(name) ?? 0 }
  })

  const goals = (goalsResp.data ?? []).map(g => ({
    name: g.name,
    target: Number(g.target_amount),
    saved: Number(g.saved_amount),
  }))

  return {
    analytics,
    monthlyData: monthlySeries(txns, now),
    trend: categoryTrend(txns, now),
    upcoming: upcoming(recResp.data ?? [], now),
    budgets,
    goals,
  }
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const authUserId = await getUserIdFromRequest()

  if (!authUserId) {
    redirect('/login')
  }

  const userId = await getLinkedUserId(authUserId)

  if (!userId) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Dashboard overview</h1>
        <GetStarted state={NOT_LINKED} />
      </div>
    )
  }

  const range = parseRange((await searchParams).range)
  const onboarding = await getOnboardingState(userId)
  const { analytics: a, monthlyData, trend, upcoming: upcomingItems, budgets, goals } = await getDashboardData(userId, range)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Dashboard overview</h1>
        <RangePicker active={range} />
      </div>
      {!isComplete(onboarding) && <GetStarted state={onboarding} />}
      <SummaryCards
        totalIncome={a.income}
        totalExpense={a.expense}
        net={a.net}
        incomeDelta={a.incomeDelta}
        expenseDelta={a.expenseDelta}
        savingsRate={a.savingsRate}
        projected={a.projected}
        label={RANGES.find(r => r.key === range)!.label}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <CategoryDonut data={a.categories} />
        <SpendTrend data={a.trend} />
        <WeekdayChart data={a.weekday} />
        <TopSpends merchants={a.topMerchants} largest={a.largest} spikes={a.spikes} />
        <BudgetProgress rows={budgets} />
        <GoalsProgress goals={goals} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <CategoryTrend keys={trend.keys} data={trend.data} />
        <UpcomingRecurring items={upcomingItems} />
      </div>
      <IncomeExpenseChart data={monthlyData} />
    </div>
  )
}
