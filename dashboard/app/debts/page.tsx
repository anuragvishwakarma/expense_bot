import type { NextPage } from 'next'
import { supabase } from '@/lib/supabase'

export const getServerSideProps = async () => {
  // Placeholder: fetch from a debts table (not yet implemented)
  const debts = [
    { id: '1', name: 'Credit Card', amount: 15000, dueDate: '2026-10-15' },
    { id: '2', name: 'Personal Loan', amount: 50000, dueDate: '2027-05-01' },
  ]
  return { props: { debts } }
}

const DebtsPage: NextPage = ({ debts }) => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Debts</h1>
      <div className="space-y-4">
        {debts.map((debt) => (
          <div key={debt.id} className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              {debt.name}
            </h3>
            <p className="mb-2">
              Amount: <span className="font-medium">₹{debt.amount.toFixed(2)}</span>
            </p>
            <p className="text-sm text-gray-500">
              Due: {new Date(debt.dueDate).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DebtsPage