import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from 'cn'
import CopyCommand from '@/components/copy-command'
import { stepDone, type OnboardingState } from '@/lib/onboarding'

const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME

const Where = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{children}</span>
)

export default function GetStarted({ state }: { state: OnboardingState }): React.ReactElement {
  const done = [true, ...stepDone(state)]
  const current = done.indexOf(false)

  const steps: { title: string; where: string; body: React.ReactNode }[] = [
    { title: 'Sign up', where: 'Dashboard', body: null },
    {
      title: 'Link your Telegram account',
      where: 'Telegram → Dashboard',
      body: (
        <>
          <p>
            Open the bot and tap <strong className="text-foreground">Start</strong>. It replies with a one-time code. Then enter the code in{' '}
            <Link href="/settings" className="text-primary underline">Settings</Link>.
          </p>
          {botUsername && (
            <a
              href={`https://t.me/${botUsername}?start=link`}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open @{botUsername}
            </a>
          )}
        </>
      ),
    },
    {
      title: 'Create an account in the bot',
      where: 'Telegram',
      body: (
        <p>
          Nothing can be logged until you have one. Send <CopyCommand text="/account add Wallet cash" /> or just{' '}
          <code className="text-foreground">/account add</code> for a button-by-button setup.
        </p>
      ),
    },
    {
      title: 'Log your first expense',
      where: 'Telegram',
      body: (
        <p>
          Send <CopyCommand text="/add 500 lunch" />. Income starts with a plus: <code className="text-foreground">+1000 salary</code>. Then refresh this page.
        </p>
      ),
    },
  ]

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-heading text-base font-semibold text-foreground">Get started</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        {done.filter(Boolean).length - 1} of {steps.length - 1} steps done
      </p>
      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                done[i] && 'border-primary bg-primary text-primary-foreground',
                i === current && 'border-primary text-primary',
                !done[i] && i !== current && 'border-border text-muted-foreground'
              )}
            >
              {done[i] ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 space-y-2 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('font-medium', done[i] ? 'text-muted-foreground' : 'text-foreground')}>{step.title}</span>
                <Where>{step.where}</Where>
              </div>
              {i === current && step.body}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
