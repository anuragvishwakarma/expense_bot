import { getSupabase } from '../db';

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  created_at: string;
  updated_at: string;
}

export class GoalService {
  async createGoal(userId: string, name: string, targetAmount: number): Promise<Goal> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        name,
        target_amount: targetAmount,
        saved_amount: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listGoals(userId: string): Promise<Goal[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateProgress(goalId: string, userId: string, amountToAdd: number): Promise<Goal> {
    const supabase = getSupabase();
    // First, get the current goal to ensure it belongs to the user and calculate new saved amount
    const { data: goal, error: fetchError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;
    if (!goal) throw new Error('Goal not found or access denied');

    const newSavedAmount = goal.saved_amount + amountToAdd;
    if (newSavedAmount > goal.target_amount) {
      throw new Error('Cannot exceed target amount');
    }

    const { data, error } = await supabase
      .from('goals')
      .update({ saved_amount: newSavedAmount, updated_at: new Date().toISOString() })
      .eq('id', goalId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteGoal(goalId: string, userId: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', userId);

    if (error) throw error;
  }
}