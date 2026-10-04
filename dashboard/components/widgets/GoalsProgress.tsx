interface GoalData {
  name: string
  target: number
  saved: number
}

export default function GoalsProgress({ goals }: { goals: GoalData[] }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-5">
      <h2 className="font-heading text-base font-semibold text-foreground">Goals progress</h2>
      {goals.length === 0 && (
        <p className="text-sm text-muted-foreground">No goals yet. In the bot: /goal set Laptop 60000</p>
      )}
      {goals.map((goal, idx) => (
        <div key={idx}>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-sm font-medium text-foreground">{goal.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              ₹{goal.saved.toFixed(2)} / ₹{goal.target.toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-[width]"
              style={{ width: `${Math.min((goal.saved / goal.target) * 100, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
