import { getSupabase } from '../db';

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_date: string; // YYYY-MM-DD
  recurrence: string | null;
  paid: boolean;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
}

export class BillService {
  async createBill(userId: string, name: string, amount: number, dueDate: string, recurrence: string | null = null): Promise<Bill> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bills')
      .insert({
        user_id: userId,
        name,
        amount,
        due_date: dueDate,
        recurrence,
        paid: false,
        paid_date: null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listBills(userId: string): Promise<Bill[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async payBill(billId: string, userId: string): Promise<Bill> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bills')
      .update({ paid: true, paid_date: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString() })
      .eq('id', billId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteBill(billId: string, userId: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', billId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // Get bills due within the next X days (default 3)
  async getUpcomingBills(userId: string, daysAhead: number = 3): Promise<Bill[]> {
    const supabase = getSupabase();
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + daysAhead);
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .eq('paid', false)
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', future.toISOString().split('T')[0])
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
