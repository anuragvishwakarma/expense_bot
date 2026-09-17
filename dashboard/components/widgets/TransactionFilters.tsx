"use client"

import { useState } from 'react'

export default function TransactionFilters({
  onChange,
}: {
  onChange: (filters: { startDate: string | null; endDate: string | null }) => void
}): React.ReactElement {
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onChange({ startDate, endDate })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input
          type="date"
          value={startDate ?? ''}
          onChange={(e) => setStartDate(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
        <input
          type="date"
          value={endDate ?? ''}
          onChange={(e) => setEndDate(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
      </div>
      <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded">
        Filter
      </button>
    </form>
  )
}