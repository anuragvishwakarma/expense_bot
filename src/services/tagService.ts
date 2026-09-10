import { getSupabase } from '../db';

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TransactionTag {
  id: string;
  transaction_id: string;
  tag_id: string;
  created_at: string;
}

export class TagService {
  async createTag(userId: string, name: string, color: string = '#808080'): Promise<Tag> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('tags')
      .insert({
        user_id: userId,
        name,
        color,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listTags(userId: string): Promise<Tag[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async updateTag(tagId: string, userId: string, updates: Partial<Tag>): Promise<Tag> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('tags')
      .update({ ...updates })
      .eq('id', tagId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteTag(tagId: string, userId: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // Link a tag to a transaction
  async tagTransaction(transactionId: string, userId: string, tagId: string): Promise<TransactionTag> {
    const supabase = getSupabase();
    // Verify transaction belongs to user
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('id')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single();
    if (txError) throw txError;
    if (!txData) throw new Error('Transaction not found or access denied');

    const { data, error } = await supabase
      .from('transaction_tags')
      .insert({
        transaction_id: transactionId,
        tag_id: tagId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Untag a tag from a transaction
  async untagTransaction(transactionId: string, userId: string, tagId: string): Promise<void> {
    const supabase = getSupabase();
    // Verify transaction belongs to user
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('id')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single();
    if (txError) throw txError;
    if (!txData) throw new Error('Transaction not found or access denied');

    const { error } = await supabase
      .from('transaction_tags')
      .delete()
      .eq('transaction_id', transactionId)
      .eq('tag_id', tagId);

    if (error) throw error;
  }

  // Get tags for a transaction
  async getTagsForTransaction(transactionId: string, userId: string): Promise<Tag[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('tags')
      .select('*, transaction_tags!inner(transaction_id)')
      .eq('transaction_tags.transaction_id', transactionId)
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  }

  // Get transactions by tag
  async getTransactionsByTag(userId: string, tagId: string): Promise<any[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('transaction_tags.tag_id', tagId); // This syntax might not work directly; we'll do a join.
    // Actually, we need to join via transaction_tags.
    // Let's do a raw query using rpc? Instead, we'll do:
    const { data2, error2 } = await supabase
      .from('transaction_tags')
      .select('transactions(*)')
      .eq('tag_id', tagId)
      .eq('transactions.user_id', userId);
    if (error2) throw error2;
    // data2 is array of { transactions: {...} }
    return data2?.map((item: any) => item.transactions) ?? [];
  }
}
