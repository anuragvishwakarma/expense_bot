import type { Txn } from '@/lib/analytics'

const inr = (n: number) => `₹${n.toFixed(2)}`

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-2">{title}</h3>
      {empty ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : <ul className="space-y-1.5 text-sm">{children}</ul>}
    </div>
  )
}

const Row = ({ left, right }: { left: string; right: string }) => (
  <li className="flex justify-between gap-3">
    <span className="truncate text-foreground">{left}</span>
    <span className="tabular-nums text-muted-foreground shrink-0">{right}</span>
  </li>
)

export default function TopSpends({
  merchants,
  largest,
  spikes,
}: {
  merchants: { name: string; total: number; count: number }[]
  largest: Txn[]
  spikes: { name: string; value: number; pct: number }[]
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-5">
      <h2 className="font-heading text-base font-semibold text-foreground">Top spends</h2>
      <Section title="Top merchants" empty={merchants.length === 0}>
        {merchants.map(m => <Row key={m.name} left={`${m.name} ×${m.count}`} right={inr(m.total)} />)}
      </Section>
      <Section title="Largest expenses" empty={largest.length === 0}>
        {largest.map((t, i) => (
          <Row key={i} left={`${t.description || t.category} · ${t.date.slice(5)}`} right={inr(Number(t.amount))} />
        ))}
      </Section>
      <Section title="Spending spikes vs previous period" empty={spikes.length === 0}>
        {spikes.map(s => <Row key={s.name} left={s.name} right={`↑ ${s.pct > 999 ? '>999' : s.pct.toFixed(0)}% · ${inr(s.value)}`} />)}
      </Section>
    </div>
  )
}
