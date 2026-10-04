import Link from 'next/link'
import { LAST_UPDATED } from '@/lib/legal'

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm text-primary underline">← Back to sign in</Link>
        <h1 className="font-heading text-3xl font-semibold text-foreground mt-6">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-8">Last updated {LAST_UPDATED}</p>
        <div className="space-y-6 text-sm leading-relaxed text-foreground/90 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-primary [&_a]:underline">
          {children}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          <Link href="/privacy" className="underline">Privacy Policy</Link> · <Link href="/terms" className="underline">Terms of Service</Link>
        </p>
      </div>
    </div>
  )
}
