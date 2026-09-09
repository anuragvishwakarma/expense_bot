import { getSupabase } from '../db';
import { parseAmount } from '../utils/parseAmount';

export class TransactionService {
  async addTransaction(userId: string, input: string, type: 'expense' | 'income') {
    const supabase = getSupabase();
    
    // Parse amount and description
    const parsed = parseAmount(input);
    if (!parsed) {
      throw new Error('Invalid amount format. Use: <amount> <description>');
    }
    
    const { amount, remainder: description } = parsed;
    
    // Try to find matching category (default to first of type)
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .eq('type', type)
      .order('name')
      .limit(1);
    
    if (catError) throw catError;
    
    const categoryId = categories?.[0]?.id || null;
    
    // Create transaction
    const { data: transaction, error: transError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        category_id: categoryId,
        amount,
        description: description || null,
        type
      })
      .single();

    if (transError) throw transError;
    return transaction;
  }

  async getTransactions(userId: string, options: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    type?: 'expense' | 'income';
  } = {}) {
    const supabase = getSupabase();
    let query = supabase
      .from('transactions')
      .select(`
        *,
        category:categories(name, icon)
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (options.limit) query = query.limit(options.limit);
    if (options.offset) query = query.offset(options.offset);
    if (options.startDate) query = query.gte('date', options.startDate);
    if (options.endDate) query = query.lte('date', options.endDate);
    if (options.type) query = query.eq('type', options.type);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}