import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase'
import { getUserIdFromRequest, getLinkedUserId } from '@/lib/auth'
import GoalsProgress from '@/components/widgets/GoalsProgress'
import NotLinked from '@/components/not-linked'

export const dynamic = 'force-dynamic'

interface Goal {
  id: string
  name: string
  target_amount: number
  saved_amount: number
}

async function getGoalsData(userId: string) {
  const supabase = await getServerSupabase()
  const { data: goals, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching goals:', error)
    return []
  }

  return (goals as Goal[]) || []
}

export default async function GoalsPage() {
  const authUserId = await getUserIdFromRequest()

  if (!authUserId) {
    redirect('/login')
  }

  const userId = await getLinkedUserId(authUserId)

  if (!userId) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Goals</h1>
        <NotLinked />
      </div>
    )
  }

  const goals = await getGoalsData(userId)
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Goals</h1>
      <GoalsProgress
        goals={goals.map((g) => ({ name: g.name, target: g.target_amount, saved: g.saved_amount }))}
      />
    </div>
  )
}