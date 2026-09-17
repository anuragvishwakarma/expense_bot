import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserIdFromRequest } from '@/lib/auth'

interface Debt {
  id: string
  counterparty: string
  amount: number
  type: 'lend' | 'borrow'
  settled: boolean
  created_at: string
}

async function getDebtsData(userId: string) {
  const { data: debts, error } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)
    .eq('settled', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching debts:', error)
    return []
  }

  return (debts as Debt[]) || []
}

export default async function DebtsPage() {
  const userId = await getUserIdFromRequest()

  if (!userId) {
    redirect('/login')
  }

  const debts = await getDebtsData(userId)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Debts</h1>
      <div className="space-y-4">
        {debts.map((debt) => (
          <div key={debt.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-500">
                {debt.counterparty}
              </h3>
              <span className={`text-xs px-2 py-1 rounded ${debt.type === 'lend' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {debt.type === 'lend' ? 'Lent' : 'Borrowed'}
              </span>
            </div>
            <p className="mb-2">
              Amount: <span className="font-medium">₹{debt.amount.toFixed(2)}</span>
            </p>
            <p className="text-sm text-gray-500">
              Created: {new Date(debt.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}