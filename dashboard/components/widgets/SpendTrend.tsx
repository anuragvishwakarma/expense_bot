"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Point { day: number; current: number | null; previous: number | null }

export default function SpendTrend({ data }: { data: Point[] }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-heading text-base font-semibold text-foreground mb-4">Cumulative spend by day</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#DDE1E6" vertical={false} />
          <XAxis dataKey="day" minTickGap={24} tick={{ fontSize: 12, fill: '#5B6472' }} axisLine={{ stroke: '#DDE1E6' }} tickLine={false} />
          <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 12, fill: '#5B6472' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v) => `₹${Number(v).toFixed(2)}`}
            labelFormatter={(d) => `Day ${d}`}
            contentStyle={{ borderColor: '#DDE1E6', borderRadius: 8, fontSize: 13 }}
          />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 13 }} />
          <Line dataKey="current" name="This period" stroke="#A3352A" strokeWidth={2} dot={false} connectNulls={false} />
          <Line dataKey="previous" name="Previous period" stroke="#5B6472" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
