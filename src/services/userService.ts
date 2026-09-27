import { getSupabase } from '../db';

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface UserRow {
  id: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', type: 'expense' as const, icon: '🍽️' },
  { name: 'Transportation', type: 'expense' as const, icon: '🚗' },
  { name: 'Shopping', type: 'expense' as const, icon: '🛍️' },
  { name: 'Entertainment', type: 'expense' as const, icon: '🎬' },
  { name: 'Bills & Utilities', type: 'expense' as const, icon: '💡' },
  { name: 'Healthcare', type: 'expense' as const, icon: '🏥' },
  { name: 'Education', type: 'expense' as const, icon: '📚' },
  { name: 'Salary', type: 'income' as const, icon: '💰' },
  { name: 'Freelance', type: 'income' as const, icon: '💻' },
  { name: 'Investment', type: 'income' as const, icon: '📈' },
  { name: 'Other Income', type: 'income' as const, icon: '💵' },
];

async function createDefaultCategories(userId: string) {
  const supabase = getSupabase();
  const categories = DEFAULT_CATEGORIES.map(c => ({
    user_id: userId,
    name: c.name,
    type: c.type,
    icon: c.icon,
  }));
  const { error } = await supabase.from('categories').insert(categories);
  if (error) console.error('Error creating default categories:', error);
}

export class UserService {
  async getOrCreateUser(telegramUser: TelegramUser) {
    const supabase = getSupabase();

    // Try to find existing user
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramUser.id)
      .single<UserRow>();

    if (!findError && existingUser) {
      // Update user info if changed
      const { error: updateError } = await supabase
        .from('users')
        .update({
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id);

      if (updateError) throw updateError;
      return existingUser;
    }

    // Create new user
    const { error: createError } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name
      });

    if (createError) throw createError;

    // Fetch created user
    const { data: newUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramUser.id)
      .single<UserRow>();

    if (fetchError) throw fetchError;
    if (!newUser) throw new Error('Failed to retrieve created user');

    // Create default categories for new user
    await createDefaultCategories(newUser.id);

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