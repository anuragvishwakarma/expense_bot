import type { Upcoming } from '@/lib/recurrences'

export default function UpcomingRecurring({ items }: { items: Upcoming[] }): React.ReactElement {
  const committed = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0)
  const expected = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0)
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-heading text-base font-semibold text-foreground">Upcoming recurring · next 30 days</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-4">No recurring items. Use /recur in the bot.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Committed ₹{committed.toFixed(2)}
            {expected > 0 && <> · Expected income ₹{expected.toFixed(2)}</>}
          </p>
          <ul className="space-y-1.5 text-sm">
            {items.slice(0, 10).map((i, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span className="truncate text-foreground">
                  <span className="text-muted-foreground tabular-nums mr-2">{i.date.slice(5)}</span>
                  {i.description}
                </span>
                <span className={`tabular-nums shrink-0 ${i.type === 'expense' ? 'text-destructive' : 'text-foreground'}`}>
                  {i.type === 'expense' ? '−' : '+'}₹{i.amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          {items.length > 10 && <p className="text-xs text-muted-foreground mt-3">+{items.length - 10} more</p>}
        </>
      )}
    </div>
  )
}
