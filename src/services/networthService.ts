import { getSupabase } from '../db';

export interface NetWorth {
  net_worth: number;
  assets: number;
  liabilities: number;
  snapshot_date: string;
}

export class NetWorthService {
  async calculateNetWorth(userId: string): Promise<NetWorth> {
    const supabase = getSupabase();
    // Get total assets: sum of account.current_balance
    const { data: accountsData, error: accountsError } = await supabase
      .from('accounts')
      .select('current_balance')
      .eq('user_id', userId);

    if (accountsError) throw accountsError;
    const assets = accountsData?.reduce((sum, acc) => sum + (acc.current_balance || 0), 0) ?? 0;

    // Get total liabilities: sum of outstanding debt (amount - settled_amount)
    const { data: debtsData, error: debtsError } = await supabase
      .from('debts')
      .select('amount, settled_amount')
      .eq('user_id', userId);

    if (debtsError) throw debtsError;
    const liabilities = debtsData?.reduce((sum, debt) => sum + ((debt.amount || 0) - (debt.settled_amount || 0)), 0) ?? 0;

    const netWorth = assets - liabilities;
    const today = new Date().toISOString().split('T')[0];

    return { netWorth, assets, liabilities, snapshot_date: today };
  }

  async saveSnapshot(userId: string, netWorth: number, assets: number, liabilities: number): Promise<any> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('networth_snapshots')
      .insert({
        user_id: userId,
        net_worth: netWorth,
        assets,
        liabilities,
        snapshot_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getHistory(userId: string, limit: number = 30): Promise<any[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('networth_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }
}
