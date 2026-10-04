import Link from 'next/link'
import { RANGES, type RangeKey } from '@/lib/analytics'
import { cn } from 'cn'

export default function RangePicker({ active }: { active: RangeKey }): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {RANGES.map(r => (
        <Link
          key={r.key}
          href={`/?range=${r.key}`}
          className={cn(
            'rounded-full border px-3 py-1 text-sm',
            r.key === active
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:text-foreground'
          )}
        >
          {r.label}
        </Link>
      ))}
    </div>
  )
}
