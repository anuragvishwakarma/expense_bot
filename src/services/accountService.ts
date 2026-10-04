import { checkAmount, checkName } from '../utils/limits';
import { getSupabase } from '../db';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;
  currency_code: string;
  starting_balance: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export class AccountService {
  async createAccount(userId: string, name: string, type: string, currencyCode: string = 'INR', startingBalance: number = 0): Promise<Account> {
    name = checkName(name, 'account');
    checkAmount(startingBalance, 'starting balance', { allowZero: true });
    // Two accounts with the same name make the transfer and entry buttons ambiguous
    const existing = await this.listAccounts(userId);
    if (existing.some(a => a.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new Error(`You already have an account called "${name}". Pick a different name.`);
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
        name,
        type,
        currency_code: currencyCode,
        starting_balance: startingBalance,
        current_balance: startingBalance,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listAccounts(userId: string): Promise<Account[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getAccount(accountId: string, userId: string): Promise<Account | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows returned
    return data ?? null;
  }

  async updateAccount(accountId: string, userId: string, updates: Partial<Account>): Promise<Account> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('accounts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', accountId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteAccount(accountId: string, userId: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // ponytail: two sequential updates, not atomic; move to a Postgres function if concurrent transfers matter
  async transfer(userId: string, fromId: string, toId: string, amount: number): Promise<{ from: Account; to: Account }> {
    if (fromId === toId) throw new Error('Pick two different accounts');
    if (!(amount > 0)) throw new Error('Amount must be positive');
    const from = await this.getAccount(fromId, userId);
    const to = await this.getAccount(toId, userId);
    if (!from || !to) throw new Error('One or both accounts not found');
    if (from.current_balance < amount) {
      throw new Error(`Insufficient balance. Available: ${from.current_balance.toFixed(2)}`);
    }
    await this.updateAccount(fromId, userId, { current_balance: from.current_balance - amount });
    await this.updateAccount(toId, userId, { current_balance: to.current_balance + amount });
    return { from, to };
  }

  // Helper to get default account for a user (first account alphabetically or earliest created)
  async getDefaultAccount(userId: string): Promise<Account | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  }
}
