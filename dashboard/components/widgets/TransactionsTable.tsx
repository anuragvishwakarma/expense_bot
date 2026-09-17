"use client"

import { ArrowUpDown, Calendar, Trash2 } from 'lucide-react'

interface Transaction {
  id: string
  amount: number
  type: 'expense' | 'income'
  description: string | null
  date: string
  category?: { name: string; icon: string } | null
}

export default function TransactionsTable({ transactions }: { transactions: Transaction[] }): React.ReactElement {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-500">
        <thead className="bg-gray-50">
          <tr>
            <th className="py-3 px-4 text-left font-semibold text-gray-900">Date</th>
            <th className="py-3 px-4 text-left font-semibold text-gray-900">Description</th>
            <th className="py-3 px-4 text-left font-semibold text-gray-900">Category</th>
            <th className="py-3 px-4 text-left font-semibold text-gray-900">Amount</th>
            <th className="py-3 px-4 text-left font-semibold text-gray-900">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {transactions.map((t) => (
            <tr key={t.id} className="hover:bg-gray-50">
              <td className="py-3 px-4 text-sm text-gray-700">
                {new Date(t.date).toLocaleDateString()}
              </td>
              <td className="py-3 px-4 text-sm text-gray-700">{t.description}</td>
              <td className="py-3 px-4 text-sm text-gray-700">
                {t.category ? (
                  <>
                    <span className="inline-flex h-2.5 w-2.5 me-2 rounded-full"
                      style={{ backgroundColor: `#${t.category.icon}` }} />
                    <span className="ml-1">{t.category.name}</span>
                  </>
                ) : (
                  <span className="italic">N/A</span>
                )}
              </td>
              <td className="py-3 px-4 text-sm font-medium">
                {t.type === 'income' ? (
                  <span className="text-green-600">₹{t.amount.toFixed(2)}</span>
                ) : (
                  <span className="text-red-600">₹{t.amount.toFixed(2)}</span>
                )}
              </td>
              <td className="py-3 px-4 text-sm text-right space-x-2">
                <span className="text-xs text-gray-400">Manage</span>
              </td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-gray-500">
                No transactions found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}