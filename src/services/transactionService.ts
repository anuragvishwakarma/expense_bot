import { getSupabase } from '../db';
import { parseAmount } from '../utils/parseAmount';
import { CurrencyService } from './currencyService';
import { AccountService } from './accountService';

interface TransactionRow {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  category_name?: string | null;
  amount: number;
  currency_code: string;
  amount_base: number;
  description: string | null;
  type: 'expense' | 'income';
  date: string;
  created_at: string;
}

export class TransactionService {
  private currencyService = new CurrencyService();
  private accountService = new AccountService();

  async addTransaction(userId: string, input: string, type: 'expense' | 'income', accountId?: string, categoryName?: string): Promise<TransactionRow> {
    const supabase = getSupabase();
    
    // Parse amount, currency, and description
    const parsed = parseAmount(input);
    if (!parsed) {
      throw new Error('Invalid amount format. Use: <amount> <currency><description> or <amount> <description>');
    }
    
    const { amount, currency, remainder: description } = parsed;
    
    // Convert amount to base currency (INR) for storage and reporting
    const amountBase = await this.currencyService.convert(amount, currency, 'INR');
    
    // Determine account: use provided, else default account for user
    let accId = accountId;
    if (!accId) {
      const defaultAcc = await this.accountService.getDefaultAccount(userId);
      if (!defaultAcc) {
        throw new Error('No account found for user. Please create an account first with /account add.');
      }
      accId = defaultAcc.id;
    }
    
    // Verify account belongs to user
    const acc = await this.accountService.getAccount(accId, userId);
    if (!acc) {
      throw new Error('Account not found or access denied');
    }
    
    // Resolve category: exact case-insensitive name match when caller provides one,
    // else fall back to the original first-alphabetical-of-type behavior.
    let categoryId: string | null = null;
    let resolvedCategoryName: string | null = null;

    if (categoryName) {
      const { data: matched, error: matchError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .eq('type', type)
        .ilike('name', categoryName)
        .limit(1);

      if (matchError) throw matchError;
      categoryId = matched?.[0]?.id || null;
      resolvedCategoryName = matched?.[0]?.name || null;
    }

    if (!categoryId) {
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .eq('type', type)
        .order('name')
        .limit(1);

      if (catError) throw catError;
      categoryId = categories?.[0]?.id || null;
      resolvedCategoryName = categories?.[0]?.name || null;
    }
    
    // Create transaction
    const { data: transaction, error: transError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        account_id: accId,
        category_id: categoryId,
        amount, // original amount
        currency_code: currency,
        amount_base: amountBase, // converted to base currency (INR)
        description: description || null,
        type
      })
      .select()
      .single();

    if (transError) throw transError;

    // Update account current_balance
    const change = type === 'income' ? amountBase : -amountBase; // income increases balance, expense decreases
    const newBalance = acc.current_balance + change;
    await this.accountService.updateAccount(accId, userId, { current_balance: newBalance });

    return { ...transaction, category_name: resolvedCategoryName };
  }

  async getTransactions(userId: string, options: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    type?: 'expense' | 'income';
    accountId?: string;
  } = {}) {
    const supabase = getSupabase();
    let query = supabase
      .from('transactions')
      .select(`
        *,
        category:categories!inner(name, icon),
        account:accounts!inner(name, type, currency_code)
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (options.limit) query = query.limit(options.limit);
    if (options.offset !== undefined && options.limit) {
      query = query.range(options.offset, options.offset + options.limit - 1);
    }
    if (options.startDate) query = query.gte('date', options.startDate);
    if (options.endDate) query = query.lte('date', options.endDate);
    if (options.type) query = query.eq('type', options.type);
    if (options.accountId) query = query.eq('account_id', options.accountId);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}