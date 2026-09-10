import { getSupabase } from '../db';

export interface Debt {
  id: string;
  user_id: string;
  counterparty: string;
  amount: number;
  type: 'lend' | 'borrow';
  description: string | null;
  settled: boolean;
  settled_amount: number;
  created_at: string;
  updated_at: string;
}

export class DebtService {
  async createDebt(userId: string, counterparty: string, amount: number, type: 'lend' | 'borrow', description: string | null = null): Promise<Debt> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('debts')
      .insert({
        user_id: userId,
        counterparty,
        amount,
        type,
        description,
        settled: false,
        settled_amount: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listDebts(userId: string): Promise<Debt[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async settleDebt(debtId: string, userId: string, amount: number): Promise<Debt> {
    const supabase = getSupabase();
    // First, get the current debt to ensure it belongs to the user and calculate new settled amount
    const { data: debt, error: fetchError } = await supabase
      .from('debts')
      .select('*')
      .eq('id', debtId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;
    if (!debt) throw new Error('Debt not found or access denied');

    const newSettledAmount = debt.settled_amount + amount;
    if (newSettledAmount > debt.amount) {
      throw new Error('Cannot settle more than the debt amount');
    }

    const settled = newSettledAmount >= debt.amount;

    const { data, error } = await supabase
      .from('debts')
      .update({ settled_amount: newSettledAmount, settled, updated_at: new Date().toISOString() })
      .eq('id', debtId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteDebt(debtId: string, userId: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', debtId)
      .eq('user_id', userId);

    if (error) throw error;
  }
}