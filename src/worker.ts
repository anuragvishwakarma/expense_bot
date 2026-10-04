import { markWorkerTick } from './health';
import { alertOwner } from './utils/alert';
import { Telegraf, Context } from 'telegraf';
import { RecurrenceService } from './services/recurrenceService';
import { TransactionService } from './services/transactionService';
import { ReminderService } from './services/reminderService';
import { UserService } from './services/userService';
import { initSupabase, getSupabase } from './db';
import cron from 'node-cron';

// Tell the owner instead of dropping the occurrence silently.
async function notifyRecurrenceFailure(
  bot: Telegraf<Context>,
  rec: { user_id: string; amount: number; description: string },
  err: unknown
) {
  try {
    const { data } = await getSupabase().from('users').select('telegram_id').eq('id', rec.user_id).single();
    if (!data?.telegram_id) return;
    const reason = err instanceof Error ? err.message : 'Unknown error';
    await bot.telegram.sendMessage(
      data.telegram_id,
      `⚠️ I couldn't post your recurring "${rec.description}" (₹${rec.amount}): ${reason}\nCheck /recur and your accounts.`
    );
  } catch (notifyErr) {
    console.error('Failed to notify about recurrence failure:', notifyErr);
  }
}

export function startWorker(bot: Telegraf<Context>) {
  const recurrenceService = new RecurrenceService();
  const transactionService = new TransactionService();
  const reminderService = new ReminderService();
  const userService = new UserService();
  initSupabase(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    markWorkerTick();
    const now = new Date();

    // --- Process recurrences ---
    try {
      const recurrences = await recurrenceService.getDueRecurrences(now);
      for (const rec of recurrences) {
        try {
          // Claim the occurrence first so two overlapping instances cannot both post it.
          if (!(await recurrenceService.claimRun(rec, now))) continue;
          // ₹ prefix keeps a description like "EMI" from being read as a currency code.
          await transactionService.addTransaction(
            rec.user_id,
            `₹${rec.amount} ${rec.description}`,
            rec.type as 'expense' | 'income'
          );
        } catch (recErr: unknown) {
          console.error(`Recurrence ${rec.id} failed:`, recErr);
          await notifyRecurrenceFailure(bot, rec, recErr);
          await alertOwner(bot.telegram, 'Recurring entry failed', `${rec.description}: ${recErr instanceof Error ? recErr.message : 'unknown'}`);
        }
      }
    } catch (e) {
      console.error('Error processing recurrences:', e);
      await alertOwner(bot.telegram, 'Recurring worker error', e instanceof Error ? e.message : 'unknown');
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
      await alertOwner(bot.telegram, 'Reminder worker error', e instanceof Error ? e.message : 'unknown');
    }
  });
}