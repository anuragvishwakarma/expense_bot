import { Telegraf, Context } from 'telegraf';
import { RecurrenceService } from './services/recurrenceService';
import { TransactionService } from './services/transactionService';
import { ReminderService } from './services/reminderService';
import { UserService } from './services/userService';
import { initSupabase, getSupabase } from './db';
import cron from 'node-cron';

export function startWorker(bot: Telegraf<Context>) {
  const recurrenceService = new RecurrenceService();
  const transactionService = new TransactionService();
  const reminderService = new ReminderService();
  const userService = new UserService();
  initSupabase(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    // --- Process recurrences ---
    try {
      const supabase = getSupabase();
      const { data: users, error: userErr } = await supabase
        .from('users')
        .select('id');
      if (userErr) throw userErr;
      for (const { id: userId } of users ?? []) {
        const recurrences = await recurrenceService.getDueRecurrences(now);
        for (const rec of recurrences) {
          // Create transaction
          await transactionService.addTransaction(
            userId,
            `${rec.amount} ${rec.description}`,
            rec.type as 'expense' | 'income'
          );
        }
      }
    } catch (e) {
      console.error('Error processing recurrences:', e);
    }

    // --- Process reminders ---
    try {
      const supabase = getSupabase();
      const { data: reminders, error: remErr } = await supabase
        .from('user_reminders')
        .select('user_id, enabled, reminder_time')
        .eq('enabled', true);
      if (remErr) throw remErr;
      for (const { user_id: userId, enabled, reminder_time } of reminders ?? []) {
        const nowTime = now.toTimeString().slice(0, 5); // HH:MM
        const remTime = reminder_time.slice(0, 5);
        if (nowTime === remTime) {
          const { data: userData, error: userErr } = await supabase
            .from('users')
            .select('telegram_id')
            .eq('id', userId)
            .single();
          if (userErr) throw userErr;
          const telegramId = userData?.telegram_id;
          if (telegramId) {
            try {
              await bot.telegram.sendMessage(
                telegramId,
                `⏰ Reminder: It's time to log yesterday's expenses. Use /add or + to record income/expenses.`
              );
            } catch (sendErr) {
              console.error(`Failed to send reminder to user ${userId}:`, sendErr);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error processing reminders:', e);
    }
  });
}