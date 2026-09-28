import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase'
import { getUserIdFromRequest, getLinkedUserId } from '@/lib/auth'
import NotLinked from '@/components/not-linked'

export const dynamic = 'force-dynamic'

interface Debt {
  id: string
  counterparty: string
  amount: number
  type: 'lend' | 'borrow'
  settled: boolean
  created_at: string
}

async function getDebtsData(userId: string) {
  const supabase = await getServerSupabase()
  const { data: debts, error } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)
    .eq('settled', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching debts:', error)
    return []
  }

  return (debts as Debt[]) || []
}

export default async function DebtsPage() {
  const authUserId = await getUserIdFromRequest()

  if (!authUserId) {
    redirect('/login')
  }

  const userId = await getLinkedUserId(authUserId)

  if (!userId) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Debts</h1>
        <NotLinked />
      </div>
    )
  }

  const debts = await getDebtsData(userId)
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Debts</h1>
      <div className="space-y-3">
        {debts.map((debt) => (
          <div key={debt.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-foreground">
                {debt.counterparty}
              </h3>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  debt.type === 'lend'
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {debt.type === 'lend' ? 'Lent' : 'Borrowed'}
              </span>
            </div>
            <p className="mb-1 tabular-nums">
              <span
                className={`font-medium ${debt.type === 'lend' ? 'text-foreground' : 'text-destructive'}`}
              >
                ₹{debt.amount.toFixed(2)}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              Created {new Date(debt.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
        {debts.length === 0 && (
          <p className="text-sm text-muted-foreground">No open debts.</p>
        )}
      </div>
    </div>
  )
}