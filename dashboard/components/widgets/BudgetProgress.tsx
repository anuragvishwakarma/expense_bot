interface BudgetRow { name: string; budget: number; spent: number }

export default function BudgetProgress({ rows }: { rows: BudgetRow[] }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-5">
      <h2 className="font-heading text-base font-semibold text-foreground">Budget vs actual · this month</h2>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No budgets set. Use /budget in the bot.</p>
      )}
      {rows.map(r => {
        const pct = r.budget > 0 ? (r.spent / r.budget) * 100 : 0
        return (
          <div key={r.name}>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-sm font-medium text-foreground">{r.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                ₹{r.spent.toFixed(2)} / ₹{r.budget.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-[width] ${pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
