import type { NextPage } from 'next'
import { supabase } from '@/lib/supabase'

export const getServerSideProps = async () => {
  // Placeholder: fetch from a goals table (not yet implemented)
  const goals = [
    { id: '1', name: 'Emergency Fund', target: 100000, saved: 25000 },
    { id: '2', name: 'Vacation', target: 50000, saved: 10000 },
  ]
  return { props: { goals } }
}

const GoalsPage: NextPage = ({ goals }) => {
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
                className={`bg-blue-500 h-2.5 rounded-full`}
                style={{ width: `${Math.min((goal.saved / goal.target) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span>Saved: ₹{goal.saved.toFixed(2)}</span>
              <span>Target: ₹{goal.target.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default GoalsPage