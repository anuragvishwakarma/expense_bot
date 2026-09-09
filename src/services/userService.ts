import { getSupabase } from '../db';
import { User } from '@supabase/supabase-js';

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export class UserService {
  async getOrCreateUser(telegramUser: TelegramUser) {
    const supabase = getSupabase();
    
    // Try to find existing user
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramUser.id)
      .single();

    if (!findError && existingUser) {
      // Update user info if changed
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id)
        .single();

      if (updateError) throw updateError;
      return updatedUser;
    }

    // Create new user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name
      })
      .single();

    if (createError) throw createError;
    return newUser;
  }

  async getUserByTelegramId(telegramId: number) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error) throw error;
    return data;
  }
}