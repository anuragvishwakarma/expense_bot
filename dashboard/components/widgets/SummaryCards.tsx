import { format } from 'date-fns'

export default function SummaryCards({
  totalIncome,
  totalExpense,
  net,
}: {
  totalIncome: number
  totalExpense: number
  net: number
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-500">Total Income</h3>
        <p className="text-2xl font-bold text-green-600">
          ₹{totalIncome.toFixed(2)}
        </p>
        <p className="text-xs text-gray-400">
          This month • {format(new Date(), 'MMM yyyy')}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-500">Total Expense</h3>
        <p className="text-2xl font-bold text-red-600">
          ₹{totalExpense.toFixed(2)}
        </p>
        <p className="text-xs text-gray-400">
          This month • {format(new Date(), 'MMM yyyy')}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-500">Net Balance</h3>
        <p className="text-2xl font-bold {net >= 0 ? 'text-green-600' : 'text-red-600'}">
          ₹{net.toFixed(2)}
        </p>
        <p className="text-xs text-gray-400">
          This month • {format(new Date(), 'MMM yyyy')}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-500">Goals Progress</h3>
        <div className="flex items-center mt-2">
          <div className="w-3 h-3 bg-blue-500 rounded mr-2" />
          <span className="text-sm text-gray-600">On Track</span>
        </div>
      </div>
    </div>
  )
}