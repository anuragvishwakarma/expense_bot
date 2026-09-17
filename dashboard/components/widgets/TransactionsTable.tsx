"use client"

import { cn } from 'cn'

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
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 px-6 text-left font-medium text-muted-foreground">Date</th>
            <th className="py-3 px-6 text-left font-medium text-muted-foreground">Description</th>
            <th className="py-3 px-6 text-left font-medium text-muted-foreground">Category</th>
            <th className="py-3 px-6 text-right font-medium text-muted-foreground">Amount</th>
            <th className="py-3 px-6 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {transactions.map((t) => (
            <tr key={t.id} className="hover:bg-accent/40 transition-colors">
              <td className="py-3 px-6 text-foreground/80">
                {new Date(t.date).toLocaleDateString()}
              </td>
              <td className="py-3 px-6 text-foreground">{t.description}</td>
              <td className="py-3 px-6 text-foreground/80">
                {t.category ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: `#${t.category.icon}` }}
                    />
                    {t.category.name}
                  </span>
                ) : (
                  <span className="italic text-muted-foreground">N/A</span>
                )}
              </td>
              <td
                className={cn(
                  'py-3 px-6 text-right font-medium tabular-nums',
                  t.type === 'income' ? 'text-foreground' : 'text-destructive'
                )}
              >
                ₹{t.amount.toFixed(2)}
              </td>
              <td className="py-3 px-6 text-right text-xs text-muted-foreground">Manage</td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-muted-foreground">
                No transactions found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
