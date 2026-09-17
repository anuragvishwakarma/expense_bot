"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ChartData {
  month: string
  income: number
  expense: number
}

export default function IncomeExpenseChart({ data }: { data: ChartData[] }): React.ReactElement {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(value) => `₹${value}`} />
        <Tooltip formatter={(value) => `₹${value}`} />
        <Legend verticalAlign="top" height={36} />
        <Bar dataKey="income" fill="#8884d8" name="Income" />
        <Bar dataKey="expense" fill="#82ca9d" name="Expense" />
      </BarChart>
    </ResponsiveContainer>
  )
}