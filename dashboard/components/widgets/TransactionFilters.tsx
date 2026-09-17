"use client"

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function TransactionFilters(): React.ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [startDate, setStartDate] = useState<string | null>(searchParams.get('startDate'))
  const [endDate, setEndDate] = useState<string | null>(searchParams.get('endDate'))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    router.push(`/transactions?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Start date</label>
        <input
          type="date"
          value={startDate ?? ''}
          onChange={(e) => setStartDate(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">End date</label>
        <input
          type="date"
          value={endDate ?? ''}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <button
        type="submit"
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm py-2 px-4 rounded-md transition-colors"
      >
        Filter
      </button>
    </form>
  )
}
