import { getServerSupabase } from './supabase'

export interface OnboardingState {
  linked: boolean
  hasAccount: boolean
  hasTransaction: boolean
}

export const NOT_LINKED: OnboardingState = { linked: false, hasAccount: false, hasTransaction: false }

// Steps after "sign up" (always done once you can see the dashboard).
export const stepDone = (s: OnboardingState) => [s.linked, s.hasAccount, s.hasTransaction]

export const isComplete = (s: OnboardingState) => stepDone(s).every(Boolean)

export async function getOnboardingState(userId: string | null): Promise<OnboardingState> {
  if (!userId) return NOT_LINKED
  const supabase = await getServerSupabase()
  const count = (table: 'accounts' | 'transactions') =>
    supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const [accounts, transactions] = await Promise.all([count('accounts'), count('transactions')])
  return {
    linked: true,
    hasAccount: (accounts.count ?? 0) > 0,
    hasTransaction: (transactions.count ?? 0) > 0,
  }
}
