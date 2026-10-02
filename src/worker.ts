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
      const recurrences = await recurrenceService.getDueRecurrences(now);
      for (const rec of recurrences) {
        await recurrenceService.markRun(rec.id, now);
        await transactionService.addTransaction(
          rec.user_id,
          `${rec.amount} ${rec.description}`,
          rec.type as 'expense' | 'income'
        );
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
      // Reminder times are IST (the bot's users are in India)
      const tz = { timeZone: 'Asia/Kolkata' };
      const nowTime = now.toLocaleTimeString('en-GB', { ...tz, hour: '2-digit', minute: '2-digit' });
      const today = now.toLocaleDateString('en-CA', tz);
      for (const { user_id: userId, reminder_time } of reminders ?? []) {
        if (nowTime !== reminder_time.slice(0, 5)) continue;

        // Skip users who already logged something today
        const { count } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('date', today);
        if (count) continue;

        const { data: userData, error: userErr } = await supabase
          .from('users')
          .select('telegram_id')
          .eq('id', userId)
          .single();
        if (userErr) throw userErr;
        if (!userData?.telegram_id) continue;
        try {
          await bot.telegram.sendMessage(
            userData.telegram_id,
            `⏰ Did you spend anything today? Reply like "500 lunch" to log it.`
          );
        } catch (sendErr: any) {
          console.error(`Failed to send reminder to user ${userId}:`, sendErr);
          // 403 = user blocked the bot; stop retrying daily
          if (sendErr?.response?.error_code === 403) {
            await supabase.from('user_reminders').update({ enabled: false }).eq('user_id', userId);
          }
        }
      }
    } catch (e) {
      console.error('Error processing reminders:', e);
    }
  });
}