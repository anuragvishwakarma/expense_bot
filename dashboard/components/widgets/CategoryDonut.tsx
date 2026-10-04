"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#1B2A41', '#A3352A', '#1F6F63', '#C98A2B', '#5B6472', '#7A4E9C', '#3D7EA6', '#8C6B4F']

export default function CategoryDonut({ data }: { data: { name: string; value: number }[] }): React.ReactElement {
  // Top 7 + "Other" so the legend stays readable.
  const top = data.slice(0, 7)
  const rest = data.slice(7).reduce((s, d) => s + d.value, 0)
  const slices = rest > 0 ? [...top, { name: 'Other', value: rest }] : top
  const total = slices.reduce((s, d) => s + d.value, 0)

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-heading text-base font-semibold text-foreground mb-4">Spending by category</h2>
      {slices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expenses in this period.</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-1/2">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={slices} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} stroke="none">
                  {slices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v) => `₹${Number(v).toFixed(2)}`}
                  contentStyle={{ borderColor: '#DDE1E6', borderRadius: 8, fontSize: 13 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full sm:w-1/2 space-y-1.5 text-sm">
            {slices.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate text-foreground">{s.name}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{s.value / total < 0.01 ? '<1' : ((s.value / total) * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
