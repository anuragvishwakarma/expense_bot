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

  // Adds delta to a balance without losing a concurrent change: the write only lands if the balance
  // is still the value we read (compare-and-set), otherwise re-read and retry.
  // minBalance (e.g. 0 for a debit) makes a debit that would go below it fail before writing.
  async adjustBalance(accountId: string, userId: string, delta: number, minBalance?: number): Promise<Account> {
    const supabase = getSupabase();
    for (let attempt = 0; attempt < 5; attempt++) {
      const acc = await this.getAccount(accountId, userId);
      if (!acc) throw new Error('Account not found or access denied');
      const next = Math.round((acc.current_balance + delta) * 100) / 100;
      if (minBalance !== undefined && next < minBalance) {
        throw new Error(`Insufficient balance. Available: ${acc.current_balance.toFixed(2)}`);
      }
      const { data, error } = await supabase
        .from('accounts')
        .update({ current_balance: next, updated_at: new Date().toISOString() })
        .eq('id', accountId)
        .eq('user_id', userId)
        .eq('current_balance', acc.current_balance)
        .select();
      if (error) throw error;
      if (data && data.length > 0) return data[0];
    }
    throw new Error('Your balance kept changing while saving. Please try again.');
  }

  // ponytail: debit then credit are two writes. A failed credit refunds the debit; only a crash between
  // the two statements can still leave money in neither account. A Postgres function would close that.
  async transfer(userId: string, fromId: string, toId: string, amount: number): Promise<{ from: Account; to: Account }> {
    if (fromId === toId) throw new Error('Pick two different accounts');
    if (!(amount > 0)) throw new Error('Amount must be positive');
    const from = await this.getAccount(fromId, userId);
    const to = await this.getAccount(toId, userId);
    if (!from || !to) throw new Error('One or both accounts not found');
    await this.adjustBalance(fromId, userId, -amount, 0);
    try {
      await this.adjustBalance(toId, userId, amount);
    } catch (error) {
      await this.adjustBalance(fromId, userId, amount).catch(e => console.error('Transfer refund failed:', e instanceof Error ? e.message : 'unknown'));
      throw error;
    }
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
