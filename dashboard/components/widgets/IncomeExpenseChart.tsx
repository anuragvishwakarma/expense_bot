"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ChartData {
  month: string
  income: number
  expense: number
}

const INCOME_COLOR = '#1F6F63'
const EXPENSE_COLOR = '#A3352A'

export default function IncomeExpenseChart({ data }: { data: ChartData[] }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-heading text-base font-semibold text-foreground mb-4">
        Income vs expense
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#DDE1E6" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5B6472' }} axisLine={{ stroke: '#DDE1E6' }} tickLine={false} />
          <YAxis tickFormatter={(value) => `₹${value}`} tick={{ fontSize: 12, fill: '#5B6472' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => `₹${Number(value).toFixed(2)}`}
            contentStyle={{ borderColor: '#DDE1E6', borderRadius: 8, fontSize: 13 }}
          />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="income" fill={INCOME_COLOR} name="Income" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" fill={EXPENSE_COLOR} name="Expense" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
