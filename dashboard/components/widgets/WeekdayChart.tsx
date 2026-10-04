"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function WeekdayChart({ data }: { data: { day: string; total: number }[] }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-heading text-base font-semibold text-foreground mb-4">Spending by weekday</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#DDE1E6" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#5B6472' }} axisLine={{ stroke: '#DDE1E6' }} tickLine={false} />
          <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 12, fill: '#5B6472' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v) => `₹${Number(v).toFixed(2)}`}
            contentStyle={{ borderColor: '#DDE1E6', borderRadius: 8, fontSize: 13 }}
          />
          <Bar dataKey="total" name="Spent" fill="#1B2A41" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
