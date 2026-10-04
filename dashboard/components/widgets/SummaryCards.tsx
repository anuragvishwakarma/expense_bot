import { cn } from 'cn'

function Delta({ pct, upIsBad }: { pct: number | null; upIsBad?: boolean }) {
  if (pct === null) return null
  const bad = upIsBad ? pct > 0 : pct < 0
  return (
    <span className={cn('ml-2 text-xs tabular-nums', bad ? 'text-destructive' : 'text-muted-foreground')}>
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct) > 999 ? '>999' : Math.abs(pct).toFixed(0)}% vs prev
    </span>
  )
}

export default function SummaryCards({
  totalIncome,
  totalExpense,
  net,
  incomeDelta,
  expenseDelta,
  savingsRate,
  projected,
  label,
}: {
  totalIncome: number
  totalExpense: number
  net: number
  incomeDelta: number | null
  expenseDelta: number | null
  savingsRate: number | null
  projected: number | null
  label: string
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="grid gap-6 sm:grid-cols-[2fr_1fr_1fr] items-end">
        <div>
          <p className="text-sm text-muted-foreground">Net balance · {label}</p>
          <p
            className={cn(
              'font-heading text-4xl font-semibold tabular-nums mt-1',
              net >= 0 ? 'text-foreground' : 'text-destructive'
            )}
          >
            ₹{net.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {savingsRate !== null && <>Savings rate {savingsRate.toFixed(0)}%</>}
            {projected !== null && <>{savingsRate !== null && ' · '}On pace for ₹{projected.toFixed(0)} expense</>}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Income</p>
          <p className="text-xl font-medium tabular-nums text-foreground mt-1">
            ₹{totalIncome.toFixed(2)}
          </p>
          <Delta pct={incomeDelta} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Expense</p>
          <p className="text-xl font-medium tabular-nums text-destructive mt-1">
            ₹{totalExpense.toFixed(2)}
          </p>
          <Delta pct={expenseDelta} upIsBad />
        </div>
      </div>
    </div>
  )
}
