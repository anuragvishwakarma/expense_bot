"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#1B2A41', '#A3352A', '#1F6F63', '#C98A2B', '#7A4E9C', '#5B6472']

export default function CategoryTrend({ keys, data }: { keys: string[]; data: Record<string, number | string>[] }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-heading text-base font-semibold text-foreground mb-4">Category trend · last 6 months</h2>
      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expenses yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DDE1E6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5B6472' }} axisLine={{ stroke: '#DDE1E6' }} tickLine={false} />
            <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 12, fill: '#5B6472' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => `₹${Number(v).toFixed(2)}`}
              contentStyle={{ borderColor: '#DDE1E6', borderRadius: 8, fontSize: 13 }}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 13 }} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} stackId="a" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
