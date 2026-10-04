import GetStarted from '@/components/get-started'
import { getUserIdFromRequest, getLinkedUserId } from '@/lib/auth'
import { getOnboardingState } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{children}</code>
)

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-lg border border-border bg-card p-6 space-y-3">
    <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
    <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
  </section>
)

const widgets: [string, string][] = [
  ['Net balance', 'Income minus expense for the selected range.'],
  ['Savings rate', '(Income − expense) ÷ income.'],
  ['↑/↓ vs prev', 'Change against the period right before it. "This month" compares the same number of days of last month.'],
  ['On pace for', 'This month only: spend so far ÷ days elapsed × days in the month.'],
  ['Spending by category', 'Where your expenses went. Small categories group into "Other".'],
  ['Cumulative spend by day', 'Running total of spend; the dashed line is the previous period. Above it means you are spending faster.'],
  ['Budget vs actual', 'This month\'s spend against budgets you set in the bot. Amber at 80%, red at 100%.'],
  ['Spending by weekday', 'Total expense per day of the week, to spot weekend spikes.'],
  ['Top spends', 'Top merchants by description, largest expenses, and categories that more than doubled vs the previous period.'],
  ['Category trend', 'Last 6 months stacked by your top 5 categories.'],
  ['Upcoming recurring', 'Bills and income scheduled in the next 30 days, from /recur.'],
]

export default async function GuidePage() {
  const authUserId = await getUserIdFromRequest()
  const onboarding = await getOnboardingState(authUserId ? await getLinkedUserId(authUserId) : null)

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Quick guide</h1>

      <GetStarted state={onboarding} />

      <Card title="1. Set it up for better insights">
        <ul className="list-disc space-y-1 pl-5">
          <li>Budgets: <Code>/budget Food 5000 10 2026</Code> (category, amount, month, year) fills the Budget widget.</li>
          <li>Recurring bills: <Code>/recur add 1000 rent expense every 1 month</Code> fills Upcoming recurring.</li>
          <li>Goals: <Code>/goal set Laptop 60000</Code>, then <Code>/goal progress &lt;id&gt; 5000</Code>.</li>
          <li>Debts: <Code>/debt lend Sam 500</Code> or <Code>/debt borrow Sam 500</Code>.</li>
          <li>Daily reminder: <Code>/reminder on 21:00</Code>.</li>
        </ul>
        <p>Send <Code>/help</Code> in the bot for every command. You can also send a voice note or a photo of a receipt.</p>
      </Card>

      <Card title="2. Reading the Overview">
        <p>
          Use the range buttons at the top (this month, last month, 3 or 6 months, year to date). Most widgets follow the range.
          Budget vs actual, Category trend and Income vs expense always show fixed windows.
        </p>
        <dl className="space-y-2">
          {widgets.map(([term, desc]) => (
            <div key={term}>
              <dt className="font-medium text-foreground">{term}</dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Good to know">
        <ul className="list-disc space-y-1 pl-5">
          <li>Amounts are in ₹ (INR).</li>
          <li>To fix a mistake, send <Code>/recent</Code> in the bot, tap the entry, and delete it. Undo buttons also appear right after you log.</li>
          <li>Empty widgets just mean there is no data yet. Each one tells you the command that fills it.</li>
        </ul>
      </Card>
    </div>
  )
}
