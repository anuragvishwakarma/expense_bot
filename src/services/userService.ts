import { getSupabase } from '../db';
import * as crypto from 'crypto';

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
  { name: 'Groceries', type: 'expense' as const, icon: '🛒' },
  { name: 'Rent / Housing', type: 'expense' as const, icon: '🏠' },
  { name: 'Fuel', type: 'expense' as const, icon: '⛽' },
  { name: 'Travel', type: 'expense' as const, icon: '✈️' },
  { name: 'Subscriptions', type: 'expense' as const, icon: '📺' },
  { name: 'Insurance', type: 'expense' as const, icon: '🛡️' },
  { name: 'EMI / Loans', type: 'expense' as const, icon: '🏦' },
  { name: 'Personal Care', type: 'expense' as const, icon: '💆' },
  { name: 'Gifts & Donations', type: 'expense' as const, icon: '🎁' },
  { name: 'Fitness', type: 'expense' as const, icon: '🏋️' },
  { name: 'Taxes', type: 'expense' as const, icon: '🧾' },
  { name: 'Miscellaneous', type: 'expense' as const, icon: '🗂️' },
  { name: 'Salary', type: 'income' as const, icon: '💰' },
  { name: 'Freelance', type: 'income' as const, icon: '💻' },
  { name: 'Investment', type: 'income' as const, icon: '📈' },
  { name: 'Other Income', type: 'income' as const, icon: '💵' },
  { name: 'Business', type: 'income' as const, icon: '🏢' },
  { name: 'Interest', type: 'income' as const, icon: '🏧' },
  { name: 'Rental Income', type: 'income' as const, icon: '🏘️' },
  { name: 'Refund / Cashback', type: 'income' as const, icon: '↩️' },
  { name: 'Gift Received', type: 'income' as const, icon: '🎉' },
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

  async isLinked(userId: string): Promise<boolean> {
    const { data, error } = await getSupabase().from('users').select('auth_user_id').eq('id', userId).single();
    if (error) throw error;
    return !!data?.auth_user_id;
  }

  // Detach the dashboard login and drop any pending code.
  async unlink(userId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('users')
      .update({ auth_user_id: null, link_code_hash: null, link_code_expires_at: null })
      .eq('id', userId);
    if (error) throw error;
  }

  async generateLinkCode(userId: string): Promise<{ code: string; expiresAt: string }> {
    const supabase = getSupabase();
    // CSPRNG, not Math.random(); only the hash is persisted so a DB read
    // never exposes a redeemable code.
    // 8 digits: 10^8 guesses per attempt window instead of 10^6
    const code = crypto.randomInt(10_000_000, 100_000_000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('users')
      .update({ link_code_hash: codeHash, link_code_expires_at: expiresAt })
      .eq('id', userId);

    if (error) throw error;
    return { code, expiresAt };
  }
}