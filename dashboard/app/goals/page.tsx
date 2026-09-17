import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserIdFromRequest } from '@/lib/auth'

interface Goal {
  id: string
  name: string
  target_amount: number
  saved_amount: number
}

async function getGoalsData(userId: string) {
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
  const userId = await getUserIdFromRequest()

  if (!userId) {
    redirect('/login')
  }

  const goals = await getGoalsData(userId)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Goals</h1>
      <div className="space-y-4">
        {goals.map((goal) => (
          <div key={goal.id} className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              {goal.name}
            </h3>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-500 h-2.5 rounded-full"
                style={{ width: `${Math.min((goal.saved_amount / goal.target_amount) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span>Saved: ₹{goal.saved_amount.toFixed(2)}</span>
              <span>Target: ₹{goal.target_amount.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}