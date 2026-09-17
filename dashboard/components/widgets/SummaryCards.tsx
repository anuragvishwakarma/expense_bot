import { cn } from 'cn'

export default function SummaryCards({
  totalIncome,
  totalExpense,
  net,
}: { totalIncome: number; totalExpense: number; net: number }): React.ReactElement {
  const monthYear = new Date().toLocaleString('default', { month: 'short', year: 'numeric' })
  return (
    <div className="rounded-lg border border-border bg-card p-6 mb-6">
      <div className="grid gap-6 sm:grid-cols-[2fr_1fr_1fr] items-end">
        <div>
          <p className="text-sm text-muted-foreground">Net balance · {monthYear}</p>
          <p
            className={cn(
              'font-heading text-4xl font-semibold tabular-nums mt-1',
              net >= 0 ? 'text-foreground' : 'text-destructive'
            )}
          >
            ₹{net.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Income</p>
          <p className="text-xl font-medium tabular-nums text-foreground mt-1">
            ₹{totalIncome.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Expense</p>
          <p className="text-xl font-medium tabular-nums text-destructive mt-1">
            ₹{totalExpense.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  )
}
