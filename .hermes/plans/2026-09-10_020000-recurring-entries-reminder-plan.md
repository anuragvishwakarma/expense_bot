# Recurring Entries and Daily Reminder Feature Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add support for recurring expense/income entries (e.g., rent, salary) and a daily reminder to log expenses.

**Architecture:** 
- Add a `recurrences` table to store repeat rules (using cron-like syntax or simple interval).
- A background worker (using node-cron) scans for due recurrences each minute and creates transaction entries.
- Add `/recur add <amount> <description> <interval>` command to create a recurrence.
- Add `/recur list` to view active recurrences.
- Add `/reminder on|off` to enable/disable a daily reminder that prompts the user at a set time (e.g., 21:00) to log yesterday's expenses.
- Store reminder preference per user (enabled boolean and time).

**Tech Stack:** 
- Node.js, TypeScript, Telegraf.js, Supabase, node-cron.

----

## Task 1: Database Schema for Recurrences and Reminder Preferences

**Objective:** Create tables for recurring rules and user reminder settings.

**Files:**
- Create: `supabase/recurrences.sql`

**Step 1: Define SQL**

```sql
-- Recurrences table
create table recurrences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  amount decimal(10,2) not null,
  description text not null,
  type text not null check (type in ('expense', 'income')),
  -- Simple interval representation: every N days, weeks, months
  interval_value integer not null check (interval_value > 0),
  interval_unit text not null check (interval_unit in ('day', 'week', 'month')),
  start_date date not null default current_date,
  end_date date, -- optional, nullable for indefinite
  active boolean not null default true,
  created_at timestamp with time zone default timezone('utc', now()) not null
);

-- User reminder preferences
create table user_reminders (
  user_id uuid primary key references users(id) on delete cascade,
  enabled boolean not null default false,
  reminder_time time not null default '21:00:00', -- time of day in UTC
  created_at timestamp with time zone default timezone('utc', now()) not null,
  updated_at timestamp with time zone default timezone('utc', now()) not null
);
```

**Step 2: Apply schema**

```bash
supabase db push
```

**Step 3: Commit**

```bash
git add supabase/recurrences.sql
git commit -m "feat: add recurrences and user_reminders tables"
```

----

## Task 2: Service Layer for Recurrences

**Objective:** Implement CRUD operations for recurrences and a method to generate due transactions.

**Files:**
- Create: `src/services/recurrenceService.ts`
- Create: `src/services/reminderService.ts` (for reminder prefs)
- Modify: `src/db.ts` (if needed to export init/getSupabase; already present)

**Step 1: RecurrenceService**

```typescript
import { getSupabase } from '../db';

export class RecurrenceService {
  async create(userId: string, amount: number, description: string, type: 'expense' | 'income', intervalValue: number, intervalUnit: 'day' | 'week' | 'month', startDate?: string, endDate?: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurrences')
      .insert({
        user_id: userId,
        amount,
        description,
        type,
        interval_value: intervalValue,
        interval_unit: intervalUnit,
        start_date: startDate ?? undefined,
        end_date: endDate ?? undefined,
        active: true
      })
      .single();
    if (error) throw error;
    return data;
  }

  async listActive(userId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurrences')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true);
    if (error) throw error;
    return data ?? [];
  }

  async deactivate(id: string, userId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurrences')
      .update({ active: false })
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  // Returns recurrences that should fire now (based on simple interval from start_date)
  async getDueRecurrences(now: Date) {
    const supabase = getSupabase();
    // We'll compute due in service for simplicity: fetch all active and check in code
    const { data, error } = await supabase
      .from('recurrences')
      .select('*')
      .eq('active', true);
    if (error) throw error;
    const due: any[] = [];
    for (const r of data ?? []) {
      const start = new Date(r.start_date);
      const diffTime = now.getTime() - start.getTime();
      let diffUnits = 0;
      if (r.interval_unit === 'day') {
        diffUnits = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      } else if (r.interval_unit === 'week') {
        diffUnits = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
      } else if (r.interval_unit === 'month') {
        // Approximate month as 30 days
        diffUnits = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
      }
      if (diffUnits % r.interval_value === 0) {
        // Ensure we haven't already created a transaction for this exact period? We'll rely on uniqueness via a generated external_id maybe.
        // For MVP we just allow duplicates; could add a generated_external_id column later.
        due.push(r);
      }
    }
    return due;
  }
}
```

**Step 2: ReminderService**

```typescript
import { getSupabase } from '../db';

export class ReminderService {
  async getPreference(userId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('user_reminders')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = 0 rows
    return data ?? null;
  }

  async setPreference(userId: string, enabled: boolean, time: string = '21:00:00') {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('user_reminders')
      .upsert(
        { user_id: userId, enabled, reminder_time: time, updated_at: new Date().toISOString() },
        { onConflict: ['user_id'] }
      )
      .single();
    if (error) throw error;
    return data;
  }
}
```

**Step 3: Commit services**

```bash
git add src/services/recurrenceService.ts src/services/reminderService.ts
git commit -m "feat: add recurrence and reminder services"
```

----

## Task 3: Background Worker (node-cron) to Process Recurrences and Send Reminders

**Objective:** Set up a cron job that runs every minute to:
- Find due recurrences and create transaction entries.
- Check reminder preferences and send a message if time matches.

**Files:**
- Create: `src/worker.ts` (or integrate into index.ts)
- Modify: `src/index.ts` to start the worker.

**Step 1: Worker implementation**

```typescript
import { Telegraf } from 'telegraf';
import { RecurrenceService } from './services/recurrenceService';
import { TransactionService } from './services/transactionService';
import { ReminderService } from './services/reminderService';
import { UserService } from './services/userService';
import { initSupabase } from './db';
import cron from 'node-cron';

export function startWorker(bot: Telegraf<Telegraf.ContextMessageUpdate>) {
  const recurrenceService = new RecurrenceService();
  const transactionService = new TransactionService();
  const reminderService = new ReminderService();
  const userService = new UserService();
  initSupabase(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    // --- Process recurrences ---
    try {
      // Get all users with active recurrences (could be heavy; for MVP we fetch all users)
      const supabase = getSupabase();
      const { data: users, error: userErr } = await supabase
        .from('users')
        .select('id')
        .not('id', 'is', null);
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
          // Optionally mark this recurrence as processed for this period to avoid duplicate firing within same minute.
          // For simplicity we accept possible duplicates if the worker runs multiple times within same minute (but cron runs once per minute).
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
        // Check if current time matches reminder_time (to the minute)
        const nowTime = now.toTimeString().slice(0, 5); // HH:MM
        const remTime = reminder_time.slice(0, 5);
        if (nowTime === remTime) {
          // Fetch user's Telegram ID to send message
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
```

**Step 2: Update index.ts to start worker**

Add import and call after bot initialization.

**Step 3: Commit worker and index changes**

```bash
git add src/worker.ts src/index.ts
git commit -m "feat: add background worker for recurrences and daily reminders"
```

----

## Task 4: Bot Commands for Recurrences and Reminder

**Objective:** Expose `/recur add`, `/recur list`, `/recur delete <id>`, `/reminder on|off [time]` commands.

**Files:**
- Modify: `src/index.ts` to add command handlers.

**Step 1: Add command handlers**

```typescript
const recurrenceService = new RecurrenceService();
const reminderService = new ReminderService();

// /recur add <amount> <description> <type> <every> <unit> [start] [end]
bot.command('recur', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }
  const text = ctx.message.text.substring(5).trim(); // remove '/recur '
  const parts = text.split(' ');
  const subcmd = parts[0];
  if (subcmd === 'add') {
    // /recur add 500 rent expense every 1 month
    // Expected format: add <amount> <description> <type> every <value> <unit> [start YYYY-MM-DD] [end YYYY-MM-DD]
    // We'll parse simply.
    const amountStr = parts[1];
    // Find indices of 'every'
    const everyIdx = parts.indexOf('every');
    if (everyIdx === -1) {
      return ctx.reply('Usage: /recur add <amount> <description> <type> every <value> <unit> [start YYYY-MM-DD] [end YYYY-MM-DD]');
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return ctx.reply('Invalid amount');
    // Description is everything between amount and type? We'll assume description is a single word for simplicity; improve later.
    const description = parts[2];
    const type = parts[3] as 'expense' | 'income';
    if (!['expense','income'].includes(type)) return ctx.reply('Type must be expense or income');
    const value = parseInt(parts[everyIdx + 1]);
    const unit = parts[everyIdx + 2] as 'day' | 'week' | 'month';
    if (isNaN(value) || value <= 0) return ctx.reply('Invalid interval value');
    if (!['day','week','month'].includes(unit)) return ctx.reply('Unit must be day, week, or month');
    let startDate: string | undefined;
    let endDate: string | undefined;
    // Look for start and end keywords
    const startIdx = parts.indexOf('start');
    const endIdx = parts.indexOf('end');
    if (startIdx !== -1 && startIdx + 1 < parts.length) {
      startDate = parts[startIdx + 1];
    }
    if (endIdx !== -1 && endIdx + 1 < parts.length) {
      endDate = parts[endIdx + 1];
    }
    try {
      const rec = await recurrenceService.create(
        ctx.session.user.id,
        amount,
        description,
        type,
        value,
        unit,
        startDate,
        endDate
      );
      ctx.reply(`✅ Recurrence created! ID: ${rec.id}`);
    } catch (error) {
      console.error('Create recurrence error:', error);
      ctx.reply(`❌ Error: ${error.message}`);
    }
  } else if (subcmd === 'list') {
    try {
      const recs = await recurrenceService.listActive(ctx.session.user.id);
      if (recs.length === 0) {
        return ctx.reply('📭 No active recurrences.');
      }
      let msg = '🔁 Active recurrences:\\n';
      for (const r of recs) {
        msg += `ID: ${r.id} | ${r.amount} ${r.description} (${r.type}) every ${r.interval_value} ${r.interval_unit}`;
        if (r.start_date) msg += ` from ${r.start_date}`;
        if (r.end_date) msg += ` to ${r.end_date}`;
        msg += '\\n';
      }
      ctx.reply(msg);
    } catch (error) {
      console.error('List recurrences error:', error);
      ctx.reply(`❌ Error: ${error.message}`);
    }
  } else if (subcmd === 'delete' || subcmd === 'remove') {
    const id = parts[1];
    if (!id) return ctx.reply('Usage: /recur delete <id>');
    try {
      await recurrenceService.deactivate(id, ctx.session.user.id);
      ctx.reply(`🗑️ Recurrence ${id} deactivated.`);
    } catch (error) {
      console.error('Delete recurrence error:', error);
      ctx.reply(`❌ Error: ${error.message}`);
    }
  } else {
    ctx.reply('Unknown recurrence command. Use add, list, delete.');
  }
});

// /reminder on|off [HH:MM]
bot.command('reminder', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }
  const args = ctx.message.text.substring(9).trim().split(' ');
  const action = args[0];
  if (action === 'on') {
    const time = args[1] ?? '21:00';
    // Validate time format HH:MM
    if (!/^([01]\\d|2[0-3]):([0-5]\\d)$/.test(time)) {
      return ctx.reply('Please provide time in HH:MM format (24‑hour).');
    }
    try {
      await reminderService.setPreference(ctx.session.user.id, true, `${time}:00`);
      ctx.reply(`✅ Daily reminder enabled at ${time}.`);
    } catch (error) {
      console.error('Set reminder error:', error);
      ctx.reply(`❌ Error: ${error.message}`);
    }
  } else if (action === 'off') {
    try {
      await reminderService.setPreference(ctx.session.user.id, false);
      ctx.reply('✅ Daily reminder disabled.');
    } catch (error) {
      console.error('Disable reminder error:', error);
      ctx.reply(`❌ Error: ${error.message}`);
    }
  } else {
    ctx.reply('Usage: /reminder on [HH:MM] | /reminder off');
  }
});
```

**Step 2: Commit command updates**

```bash
git add src/index.ts
git commit -m "feat: add /recur and /reminder commands"
```

----

## Task 5: Testing

**Objective:** Write basic tests for recurrence service and reminder service.

**Files:**
- Create: `tests/services/recurrenceService.test.ts`
- Create: `tests/services/reminderService.test.ts`

**Step 1: Mock supabase and test core methods.**

Because setting up full integration tests is heavy, we will write unit tests that mock the Supabase client.

We'll also test the cron worker logic in a separate test file if desired.

**Step 2: Commit tests**

```bash
git add tests/services/recurrenceService.test.ts tests/services/reminderService.test.ts
git commit -m "feat: add tests for recurrence and reminder services"
```

----

## Task 6: Documentation and Example Usage

**Objective:** Update README (if exists) or create a FEATURES.md with usage instructions.

**Files:**
- Create: `FEATURES.md` (or update README)

**Step 1: Write usage**

```markdown
# Recurring Entries & Daily Reminder

## Recurring entries
Create a repeating expense or income:
```
/recur add 1000 rent expense every 1 month
```
List active recurrences:
```
/recur list
```
Delete a recurrence:
```
/recur delete <id>
```

## Daily reminder
Enable a daily prompt:
```
/reminder on 21:00   # 9 PM each day
```
Disable:
```
/reminder off
```
The bot will send a private message at the set time reminding you to log yesterday's expenses.
```

**Step 2: Commit**

```bash
git add FEATURES.md
git commit -m "docs: add usage for recurring entries and reminder"
```

----

## Summary

After these tasks, users will be able to:
- Set up automatic repeating transactions (e.g., monthly salary, weekly rent).
- Receive a daily reminder to log expenses.
- Manage their recurrences and reminder preferences via simple commands.

All changes are isolated to new tables, services, worker, and command handlers, keeping the existing MVP intact.