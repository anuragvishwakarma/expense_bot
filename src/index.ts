import { Telegraf, Context, session } from 'telegraf';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { UserService } from './services/userService';
import { initSupabase } from './db';
import { TransactionService } from './services/transactionService';
import { ReportService } from './services/reportService';
import { BudgetService } from './services/budgetService';
import { RecurrenceService } from './services/recurrenceService';
import { ReminderService } from './services/reminderService';
import { OCRService } from './services/ocrService';
import { GoalService } from './services/goalService';
import { DebtService } from './services/debtService';
import { VoiceService } from './services/voiceService';
import { AccountService } from './services/accountService';
import { startWorker } from './worker';
import { HELP_MESSAGE, ERROR_MESSAGES } from './utils/helpMessages';
import axios from 'axios';
import { parseAmount } from './utils/parseAmount';
import { extractFromOcrText } from './utils/extractFromOcrText';
import { configureProductionBot } from './production';

interface SessionData {
  user: {
    id: string;
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

interface BotContext extends Context {
  session: SessionData;
}

dotenv.config();
const ocrService = new OCRService();

const bot = new Telegraf<BotContext>(process.env.TELEGRAM_BOT_TOKEN || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);
const userService = new UserService();
const transactionService = new TransactionService();
const reportService = new ReportService();
const budgetService = new BudgetService();
const recurrenceService = new RecurrenceService();
const reminderService = new ReminderService();
const goalService = new GoalService();
const debtService = new DebtService();
const voiceService = new VoiceService();
const accountService = new AccountService();
// Pending OCR results map
const pendingOCR = new Map<string, {amount: number; description: string; date: string}>();
// Pending voice transcriptions map
const voicePending = new Map<string, string>();

// Initialize Supabase in service
initSupabase(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

// Session middleware
bot.use(session());

// Start background worker for recurrences and reminders
startWorker(bot as unknown as Telegraf<Context>);
bot.use(async (ctx, next) => {
  if (ctx.from) {
    try {
      const user = await userService.getOrCreateUser({
        id: ctx.from.id,
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name
      });
      ctx.session.user = user;
    } catch (error: unknown) {
      console.error('User service error:', error);
      ctx.reply('Sorry, there was an error processing your request. Please try again.');
      return;
    }
  }
  return next();
});

// Start command
bot.start((ctx) => ctx.reply('Welcome to Expense Tracker Bot! Use /help to see available commands.'));

// Help command
bot.command('help', (ctx) => {
  ctx.reply(HELP_MESSAGE, { parse_mode: 'Markdown' });
});

// Add expense command
bot.command('add', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }

  const input = ctx.message.text.substring(4).trim(); // Remove '/add '
  if (!input) {
    return ctx.reply('Please provide an amount and description. Example: /add 500 lunch');
  }

  try {
    const transaction = await transactionService.addTransaction(
      ctx.session.user.id,
      input,
      'expense'
    );

    ctx.reply(`✅ Expense recorded!\nAmount: ₹${transaction.amount}\nDescription: ${transaction.description || 'N/A'}`);
  } catch (error: unknown) {
    console.error('Add expense error:', error);
    ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
  }
});

// Add income command (using + prefix or /income)
bot.on('text', async (ctx) => {
  if (!ctx.session.user) return;

  const text = ctx.message.text.trim();

  // Handle + income format
  if (text.startsWith('+')) {
    const amountText = text.substring(1).trim();
    if (!amountText) return;

    try {
      const transaction = await transactionService.addTransaction(
        ctx.session.user.id,
        amountText,
        'income'
      );

      ctx.reply(`✅ Income recorded!\nAmount: ₹${transaction.amount}\nDescription: ${transaction.description || 'N/A'}`);
    } catch (error: unknown) {
      console.error('Add income error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
  }
});

// Income command alternative
bot.command('income', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }

  const input = ctx.message.text.substring(8).trim(); // Remove '/income '
  if (!input) {
    return ctx.reply('Please provide an amount and description. Example: /income 1000 salary');
  }

  try {
    const transaction = await transactionService.addTransaction(
      ctx.session.user.id,
      input,
      'income'
    );

    ctx.reply(`✅ Income recorded!\nAmount: ₹${transaction.amount}\nDescription: ${transaction.description || 'N/A'}`);
  } catch (error: unknown) {
    console.error('Add income error:', error);
    ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
  }
});

// Daily report command
bot.command('today', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }

  try {
    const summary = await reportService.getDailySummary(ctx.session.user.id);

    let message = `📊 *Today's Summary* (${summary.date})\n\n`;
    message += `💰 Income: ₹${summary.totalIncome.toFixed(2)}\n`;
    message += `💸 Expense: ₹${summary.totalExpense.toFixed(2)}\n`;
    message += `📈 Net: ₹${summary.net.toFixed(2)}\n\n`;

    if (Object.keys(summary.expenseByCategory).length > 0) {
      message += `*Expenses by Category:*\n`;
      for (const [category, amount] of Object.entries(summary.expenseByCategory)) {
        message += `• ${category}: ₹${amount.toFixed(2)}\n`;
      }
      message += '\n';
    }

    if (Object.keys(summary.incomeByCategory).length > 0) {
      message += `*Income by Category:*\n`;
      for (const [category, amount] of Object.entries(summary.incomeByCategory)) {
        message += `• ${category}: ₹${amount.toFixed(2)}\n`;
      }
    }

    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error: unknown) {
    console.error('Today report error:', error);
    ctx.reply(`❌ Error generating report: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
  }
});

// Monthly report command
bot.command('monthly', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }

  const args = ctx.message.text.split(' ');
  let month = new Date().getMonth() + 1; // Current month (1-12)
  let year = new Date().getFullYear();

  if (args.length >= 2) {
    month = parseInt(args[1]);
    year = parseInt(args[2] || year.toString());

    if (isNaN(month) || month < 1 || month > 12) {
      return ctx.reply('Please provide a valid month (1-12)');
    }
    if (isNaN(year) || year < 2020) {
      return ctx.reply('Please provide a valid year');
    }
  }

  try {
    const summary = await reportService.getMonthlySummary(ctx.session.user.id, year, month);

    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    let message = `📊 *${monthName} ${year} Summary*\n\n`;
    message += `💰 Income: ₹${summary.totalIncome.toFixed(2)}\n`;
    message += `💸 Expense: ₹${summary.totalExpense.toFixed(2)}\n`;
    message += `📈 Net: ₹${summary.net.toFixed(2)}\n\n`;

    if (Object.keys(summary.expenseByCategory).length > 0) {
      message += `*Top Expense Categories:*\n`;
      const sortedExpenses = Object.entries(summary.expenseByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      for (const [category, amount] of sortedExpenses) {
        message += `• ${category}: ₹${amount.toFixed(2)}\n`;
      }
      message += '\n';
    }

    message += `_Transactions: ${summary.transactionCount}_`;

    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error: unknown) {
    console.error('Monthly report error:', error);
    ctx.reply(`❌ Error generating report: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
  }
});

// Export command
bot.command('export', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }

  const args = ctx.message.text.split(' ');
  let startDate = new Date().toISOString().split('T')[0]; // Today
  let endDate = startDate;

  if (args.length >= 2) {
    startDate = args[1];
    endDate = args[2] || startDate;

    // Basic date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return ctx.reply('Please provide dates in YYYY-MM-DD format');
    }
  }

  try {
    const csv = await reportService.exportTransactionsCSV(
      ctx.session.user.id,
      startDate,
      endDate
    );

    // Send as file (Telegraf can handle this)
    await ctx.replyWithDocument({
      source: Buffer.from(csv),
      filename: `transactions_${startDate}_to_${endDate}.csv`
    }, {
      caption: `📄 Transaction export from ${startDate} to ${endDate}`
    });
  } catch (error: unknown) {
    console.error('Export error:', error);
    ctx.reply(`❌ Error exporting data: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
  }
});

// Set budget command
bot.command('budget', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }

  const args = ctx.message.text.split(' ');
  if (args.length < 4) {
    return ctx.reply('Usage: /budget <category> <amount> <month> <year>\nExample: /budget Food 5000 9 2026');
  }

  const category = args[1];
  const amount = parseFloat(args[2]);
  const month = parseInt(args[3]);
  const year = parseInt(args[4] || new Date().getFullYear().toString());

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('Please provide a valid budget amount');
  }
  if (isNaN(month) || month < 1 || month > 12) {
    return ctx.reply('Please provide a valid month (1-12)');
  }
  if (isNaN(year) || year < 2020) {
    return ctx.reply('Please provide a valid year');
  }

  try {
    const budget = await budgetService.setBudget(
      ctx.session.user.id,
      category,
      amount,
      month,
      year
    );

    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    ctx.reply(`✅ Budget set for ${category}!\n${monthName} ${year}: ₹${amount.toFixed(2)}`);
  } catch (error: unknown) {
    console.error('Set budget error:', error);
    ctx.reply(`❌ Error setting budget: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
  }
});

// Budget status command
bot.command('budgetstatus', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }

  const args = ctx.message.text.split(' ');
  let month = new Date().getMonth() + 1;
  let year = new Date().getFullYear();

  if (args.length >= 2) {
    month = parseInt(args[1]);
    year = parseInt(args[2] || year.toString());

    if (isNaN(month) || month < 1 || month > 12) {
      return ctx.reply('Please provide a valid month (1-12)');
    }
    if (isNaN(year) || year < 2020) {
      return ctx.reply('Please provide a valid year');
    }
  }

  try {
    const status = await budgetService.getBudgetStatus(ctx.session.user.id, month, year);

    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    let message = `💰 *Budget Status for ${monthName} ${year}*\n\n`;

    if (status.length === 0) {
      message += 'No budgets set for this month. Use /budget to set budgets.\n';
    } else {
      status.forEach(budget => {
        const statusIcon = budget.overBudget ? '🔴' : budget.percentage > 80 ? '🟡' : '🟢';
        message += `${statusIcon} ${budget.icon} ${budget.category}\n`;
        message += `   Budgeted: ₹${budget.budgeted.toFixed(2)}\n`;
        message += `   Spent: ₹${budget.spent.toFixed(2)}\n`;
        message += `   Remaining: ₹${budget.remaining.toFixed(2)} (${budget.percentage.toFixed(1)}% used)\n\n`;
      });
    }

    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error: unknown) {
    console.error('Budget status error:', error);
    ctx.reply(`❌ Error getting budget status: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
  }
});

// Recurrence commands
bot.command('recur', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }
  const text = ctx.message.text.substring(5).trim(); // remove '/recur '
  const parts = text.split(' ');
  const subcmd = parts[0];

  if (subcmd === 'add') {
    // /recur add <amount> <description> <type> every <value> <unit> [start YYYY-MM-DD] [end YYYY-MM-DD]
    // OR /recur add <amount> <description> <type> cron <expression> [start YYYY-MM-DD] [end YYYY-MM-DD]
    const amountStr = parts[1];
    if (!amountStr) {
      return ctx.reply('Usage: /recur add <amount> <description> <type> every <value> <unit> [start YYYY-MM-DD] [end YYYY-MM-DD]\n   OR: /recur add <amount> <description> <type> cron <expression> [start YYYY-MM-DD] [end YYYY-MM-DD]');
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return ctx.reply('Invalid amount');
    const description = parts[2];
    const type = parts[3] as 'expense' | 'income';
    if (!['expense','income'].includes(type)) return ctx.reply('Type must be expense or income');
    
    let intervalValue: number | null = null;
    let intervalUnit: 'day' | 'week' | 'month' | null = null;
    let cronExpression: string | null = null;
    let startDate: string | undefined;
    let endDate: string | undefined;
    
    // Determine if we have 'every' or 'cron' keyword
    const keywordIdx = parts.indexOf('every');
    const cronIdx = parts.indexOf('cron');
    if (keywordIdx !== -1) {
      // every syntax
      const valueStr = parts[keywordIdx + 1];
      const unit = parts[keywordIdx + 2] as 'day' | 'week' | 'month';
      if (!valueStr || !unit) {
        return ctx.reply('Usage: /recur add <amount> <description> <type> every <value> <unit> [start YYYY-MM-DD] [end YYYY-MM-DD]');
      }
      intervalValue = parseInt(valueStr);
      intervalUnit = unit;
      if (isNaN(intervalValue) || intervalValue <= 0) return ctx.reply('Invalid interval value');
      if (!['day','week','month'].includes(intervalUnit)) return ctx.reply('Unit must be day, week, or month');
    } else if (cronIdx !== -1) {
      // cron syntax
      const expression = parts[cronIdx + 1];
      if (!expression) {
        return ctx.reply('Usage: /recur add <amount> <description> <type> cron <expression> [start YYYY-MM-DD] [end YYYY-MM-DD]');
      }
      cronExpression = expression;
      // Validate cron expression? We'll let the service handle it.
    } else {
      return ctx.reply('Please specify either "every <value> <unit>" or "cron <expression>"');
    }
    
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
        intervalValue ?? undefined,
        intervalUnit ?? undefined,
        startDate,
        endDate,
        cronExpression ?? undefined
      );
      ctx.reply(`✅ Recurrence created! ID: ${rec.id}`);
    } catch (error: unknown) {
      console.error('Create recurrence error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
  } else if (subcmd === 'list') {
    try {
      const recs = await recurrenceService.listActive(ctx.session.user.id);
      if (recs.length === 0) {
        return ctx.reply('📭 No active recurrences.');
      }
      let msg = '🔁 Active recurrences:\n';
      for (const r of recs) {
        msg += `ID: ${r.id} | ${r.amount} ${r.description} (${r.type})`;
        if (r.cron_expression) {
          msg += ` cron: ${r.cron_expression}`;
        } else {
          msg += ` every ${r.interval_value} ${r.interval_unit}`;
        }
        if (r.start_date) msg += ` from ${r.start_date}`;
        if (r.end_date) msg += ` to ${r.end_date}`;
        msg += '\n';
      }
      ctx.reply(msg);
    } catch (error: unknown) {
      console.error('List recurrences error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
  } else if (subcmd === 'delete' || subcmd === 'remove') {
    const id = parts[1];
    if (!id) return ctx.reply('Usage: /recur delete <id>');
    try {
      await recurrenceService.deactivate(id, ctx.session.user.id);
      ctx.reply(`🗑️ Recurrence ${id} deactivated.`);
    } catch (error: unknown) {
      console.error('Delete recurrence error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
  } else {
    ctx.reply('Unknown recurrence command. Use add, list, delete.');
  }
});

// Reminder commands
bot.command('reminder', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }
  const args = ctx.message.text.substring(9).trim().split(' ');
  const action = args[0];
  if (action === 'on') {
    const time = args[1] ?? '21:00';
    // Validate time format HH:MM
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      return ctx.reply('Please provide time in HH:MM format (24-hour).');
    }
    try {
      await reminderService.setPreference(ctx.session.user.id, true, `${time}:00`);
      ctx.reply(`✅ Daily reminder enabled at ${time}.`);
    } catch (error: unknown) {
      console.error('Set reminder error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
  } else if (action === 'off') {
    try {
      await reminderService.setPreference(ctx.session.user.id, false);
      ctx.reply('✅ Daily reminder disabled.');
    } catch (error: unknown) {
      console.error('Disable reminder error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
  } else {
    ctx.reply('Usage: /reminder on [HH:MM] | /reminder off');
  }
});

// Goal commands
bot.command('goal', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }
  const text = ctx.message.text.substring(5).trim(); // remove '/goal '
  const parts = text.split(' ');
  const subcmd = parts[0];

  if (subcmd === 'set') {
    // /goal set <name> <target>
    const name = parts[1];
    const targetStr = parts[2];
    if (!name || !targetStr) {
      return ctx.reply('Usage: /goal set <name> <target_amount>');
    }
    const targetAmount = parseFloat(targetStr);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      return ctx.reply('Please provide a valid target amount');
    }
    try {
      const goal = await goalService.createGoal(ctx.session.user.id, name, targetAmount);
      ctx.reply(`✅ Goal created!\nName: ${goal.name}\nTarget: ₹${goal.target_amount.toFixed(2)}`);
    } catch (error: unknown) {
      console.error('Create goal error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
  } else if (subcmd === 'list') {
    try {
      const goals = await goalService.listGoals(ctx.session.user.id);
      if (goals.length === 0) {
        return ctx.reply('📭 No goals set yet. Use /goal set to create one.');
      }
      let msg = '🎯 Your goals:\n';
      for (const g of goals) {
        const progress = (g.saved_amount / g.target_amount) * 100;
        msg += `• ${g.name}: ₹${g.saved_amount.toFixed(2)} / ₹${g.target_amount.toFixed(2)} (${progress.toFixed(1)}%)\n`;
      }
      ctx.reply(msg);
    } catch (error: unknown) {
      console.error('List goals error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
  } else if (subcmd === 'progress') {
    // /goal progress <id> <amount>
    const goalId = parts[1];
    const amountStr = parts[2];
    if (!goalId || !amountStr) {
      return ctx.reply('Usage: /goal progress <goal_id> <amount_to_add>');
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('Please provide a valid amount to add');
    }
    try {
      const updatedGoal = await goalService.updateProgress(goalId, ctx.session.user.id, amount);
      ctx.reply(`✅ Progress updated!\n${updatedGoal.name}: ₹${updatedGoal.saved_amount.toFixed(2)} / ₹${updatedGoal.target_amount.toFixed(2)}`);
    } catch (error: unknown) {
      console.error('Update goal progress error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
  } else if (subcmd === 'delete' || subcmd === 'remove') {
    const goalId = parts[1];
    if (!goalId) {
      return ctx.reply('Usage: /goal delete <goal_id>');
    }
    try {
      await goalService.deleteGoal(goalId, ctx.session.user.id);
      ctx.reply(`🗑️ Goal deleted.`);
    } catch (error: unknown) {
      console.error('Delete goal error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
  } else {
    ctx.reply('Unknown goal command. Use set, list, progress, delete.');
  }
});

// Global error handling

// Debt commands
bot.command('debt', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }
  const text = ctx.message.text.substring(5).trim(); // remove '/debt '
  const parts = text.split(' ');
  const subcmd = parts[0];

  if (subcmd === 'lend') {
    // /debt lend <counterparty> <amount> [description]
    const counterparty = parts[1];
    const amountStr = parts[2];
    const description = parts.slice(3).join(' ');
    if (!counterparty || !amountStr) {
      return ctx.reply('Usage: /debt lend <counterparty> <amount> [description]');
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('Please provide a valid amount');
    }
    try {
      const debt = await debtService.createDebt(ctx.session.user.id, counterparty, amount, 'lend', description || null);
      ctx.reply(`✅ Debt recorded!\nYou lent ₹${debt.amount.toFixed(2)} to ${debt.counterparty}`);
    } catch (error: unknown) {
      console.error('Create debt error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else if (subcmd === 'borrow') {
    // /debt borrow <counterparty> <amount> [description]
    const counterparty = parts[1];
    const amountStr = parts[2];
    const description = parts.slice(3).join(' ');
    if (!counterparty || !amountStr) {
      return ctx.reply('Usage: /debt borrow <counterparty> <amount> [description]');
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('Please provide a valid amount');
    }
    try {
      const debt = await debtService.createDebt(ctx.session.user.id, counterparty, amount, 'borrow', description || null);
      ctx.reply(`✅ Debt recorded!\nYou borrowed ₹${debt.amount.toFixed(2)} from ${debt.counterparty}`);
    } catch (error: unknown) {
      console.error('Create debt error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else if (subcmd === 'settle') {
    // /debt settle <id> <amount>
    const debtId = parts[1];
    const amountStr = parts[2];
    if (!debtId || !amountStr) {
      return ctx.reply('Usage: /debt settle <id> <amount>');
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('Please provide a valid amount to settle');
    }
    try {
      const updatedDebt = await debtService.settleDebt(debtId, ctx.session.user.id, amount);
      ctx.reply(`✅ Debt settled!\n${updatedDebt.counterparty}: ₹${updatedDebt.settled_amount.toFixed(2)} / ₹${updatedDebt.amount.toFixed(2)} settled`);
    } catch (error: unknown) {
      console.error('Settle debt error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else if (subcmd === 'list') {
    try {
      const debts = await debtService.listDebts(ctx.session.user.id);
      if (debts.length === 0) {
        return ctx.reply('📭 No debts recorded yet.');
      }
      let msg = '💰 Your debts:\n';
      for (const d of debts) {
        const status = d.settled ? '✅ Settled' : '⏳ Pending';
        const lentOrBorrowed = d.type === 'lend' ? 'lent' : 'borrowed';
        msg += `• ${status} ${lentOrBorrowed} ₹${d.amount.toFixed(2)} to/from ${d.counterparty}`;
        if (d.description) {
          msg += ` (${d.description})`;
        }
        msg += `\n`;
      }
      ctx.reply(msg);
    } catch (error: unknown) {
      console.error('List debts error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else if (subcmd === 'delete' || subcmd === 'remove') {
    const debtId = parts[1];
    if (!debtId) {
      return ctx.reply('Usage: /debt delete <debt_id>');
    }
    try {
      await debtService.deleteDebt(debtId, ctx.session.user.id);
      ctx.reply(`🗑️ Debt deleted.`);
    } catch (error: unknown) {
      console.error('Delete debt error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else {
    ctx.reply('Unknown debt command. Use lend, borrow, settle, list, delete.');
  }
});

// Account command
bot.command('account', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }
  const text = ctx.message.text.substring(8).trim(); // remove '/account '
  const parts = text.split(' ');
  const subcmd = parts[0];

  if (subcmd === 'add') {
    // /account add <name> <type> [currency] [starting_balance]
    const name = parts[1];
    const type = parts[2];
    const currency = parts[3] || 'INR';
    const startBalance = parts[4] ? parseFloat(parts[4]) : 0;

    if (!name || !type) {
      return ctx.reply('Usage: /account add <name> <type> [currency] [starting_balance]\nTypes: checking, savings, credit, cash, investment, other');
    }
    const validTypes = ['checking', 'savings', 'credit', 'cash', 'investment', 'other'];
    if (!validTypes.includes(type)) {
      return ctx.reply('Invalid account type. Valid types: checking, savings, credit, cash, investment, other');
    }
    if (startBalance < 0) {
      return ctx.reply('Starting balance must be non-negative');
    }
    try {
      const account = await accountService.createAccount(ctx.session.user.id, name, type, currency, startBalance);
      ctx.reply(`✅ Account created!\nName: ${account.name}\nType: ${account.type}\nCurrency: ${account.currency_code}\nBalance: ₹${account.current_balance.toFixed(2)}`);
    } catch (error: unknown) {
      console.error('Create account error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else if (subcmd === 'list') {
    try {
      const accounts = await accountService.listAccounts(ctx.session.user.id);
      if (accounts.length === 0) {
        return ctx.reply('📭 No accounts yet. Create one with /account add <name> <type>');
      }
      let msg = '💳 Your accounts:\n';
      for (const acc of accounts) {
        msg += `• ${acc.name} (${acc.type}) [${acc.currency_code}]\n  Balance: ${acc.current_balance.toFixed(2)}\n`;
      }
      ctx.reply(msg);
    } catch (error: unknown) {
      console.error('List accounts error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else if (subcmd === 'transfer') {
    // /account transfer <from_account_id> <to_account_id> <amount>
    const fromId = parts[1];
    const toId = parts[2];
    const amountStr = parts[3];

    if (!fromId || !toId || !amountStr) {
      return ctx.reply('Usage: /account transfer <from_account_id> <to_account_id> <amount>');
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('Please provide a valid transfer amount');
    }
    try {
      const fromAccount = await accountService.getAccount(fromId, ctx.session.user.id);
      const toAccount = await accountService.getAccount(toId, ctx.session.user.id);

      if (!fromAccount || !toAccount) {
        return ctx.reply('❌ One or both accounts not found');
      }
      if (fromAccount.current_balance < amount) {
        return ctx.reply(`❌ Insufficient balance. Available: ${fromAccount.current_balance.toFixed(2)}`);
      }

      await accountService.updateAccount(fromId, ctx.session.user.id, {
        current_balance: fromAccount.current_balance - amount
      });
      await accountService.updateAccount(toId, ctx.session.user.id, {
        current_balance: toAccount.current_balance + amount
      });

      ctx.reply(`✅ Transfer complete!\n${fromAccount.name} → ${toAccount.name}: ₹${amount.toFixed(2)}`);
    } catch (error: unknown) {
      console.error('Transfer error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else if (subcmd === 'delete' || subcmd === 'remove') {
    const accountId = parts[1];
    if (!accountId) {
      return ctx.reply('Usage: /account delete <account_id>');
    }
    try {
      await accountService.deleteAccount(accountId, ctx.session.user.id);
      ctx.reply('🗑️ Account deleted.');
    } catch (error: unknown) {
      console.error('Delete account error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else {
    ctx.reply('Unknown account command. Use: add, list, transfer, delete');
  }
});

// Voice message handler
bot.on('voice', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }
  try {
    // Get the voice file link
    const fileId = ctx.message.voice.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    // Transcribe the voice
    const transcription = await voiceService.transcribeVoice(fileLink.toString());
    if (!transcription) {
      return ctx.reply('❌ Could not transcribe the voice message. Please try again or enter manually with /add.');
    }
    // Store pending transcription
    voicePending.set(ctx.from.id.toString(), transcription);
    // Determine type (expense or income) based on leading '+'
    let type = 'expense';
    let displayText = transcription;
    if (transcription.startsWith('+')) {
      type = 'income';
      displayText = transcription.substring(1);
    }
    const preview = `🎙️ *Voice Transcription*\n\nYou said: "${displayText}"\n\nSave this as a ${type}?`;
    await ctx.reply(preview, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Yes, save', callback_data: 'voice_yes' },
            { text: '❌ No, cancel', callback_data: 'voice_no' }
          ]
        ]
      },
      parse_mode: 'Markdown'
    });
  } catch (error: unknown) {
    console.error('Voice message handler error:', error);
    ctx.reply('❌ Voice processing failed. Please try again later.');
  }
});

// Handle callback queries for voice confirmation
bot.action(/voice_(yes|no)/, async (ctx) => {
  const userId = ctx.from.id.toString();
  const transcription = voicePending.get(userId);
  if (!transcription) {
    return ctx.answerCbQuery('No pending voice transcription.', { show_alert: true });
  }
  if (ctx.match[1] === 'yes') {
    try {
      // Parse the transcription to get amount and description
      const parsed = parseAmount(transcription);
      if (!parsed) {
        return ctx.answerCbQuery('❌ Could not parse amount from transcription. Please try again or enter manually.', { show_alert: true });
      }
      // Determine type based on leading '+'
      let type: 'expense' | 'income' = 'expense';
      let input = transcription;
      if (transcription.startsWith('+')) {
        type = 'income';
        input = transcription.substring(1).trim();
      } else {
        input = transcription.trim();
      }
      // Use the transaction service to add the transaction
      const transaction = await transactionService.addTransaction(
        userId,
        input,
        type
      );
      ctx.editMessageText(`✅ ${type === 'income' ? 'Income' : 'Expense'} saved!\nAmount: ₹${transaction.amount}\nDescription: ${transaction.description || 'N/A'}`);
      voicePending.delete(userId);
    } catch (error: unknown) {
      console.error('Save voice transaction error:', error);
      ctx.answerCbQuery('❌ Failed to save transaction.', { show_alert: true });
    }
} else {
    ctx.editMessageText('❌ Voice transaction discarded.');
    voicePending.delete(userId);
  }
});

bot.catch((err, ctx) => {
  console.error('Error in bot:', err);
  ctx.reply(ERROR_MESSAGES.GENERAL_ERROR);
});

// Production readiness
if (process.env.NODE_ENV === 'production') {
  configureProductionBot(bot as unknown as Telegraf<Context>);
}

// Helper to send confirmation keyboard
function getConfirmationKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Yes, save', callback_data: 'ocr_yes' },
          { text: '❌ No, cancel', callback_data: 'ocr_no' }
        ]
      ]
    }
  };
}

// Photo handler for OCR
bot.on('photo', async (ctx) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }
  // Get the largest photo
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const file_id = photo.file_id;
  try {
    const fileLink = await ctx.telegram.getFileLink(file_id);
    const ocrResult = await ocrService.getOCRFromUrl(fileLink.toString());
    if (!ocrResult || !ocrResult.text) {
      return ctx.reply('❌ OCR failed to extract text from the image. Please try a clearer photo or enter manually with /add.');
    }
    const parsed = OCRService.parseOCRResult(ocrResult.text);
    if (!parsed) {
      return ctx.reply('❌ Could not parse amount/date from OCR text. Please try again or enter manually.');
    }
    // Store pending result keyed by user id
    pendingOCR.set(ctx.from.id.toString(), parsed);
    const preview = `🧾 *OCR Result*\\n\\n*Amount:* ₹${parsed.amount.toFixed(2)}\\n*Description:* ${parsed.description}\\n*Date:* ${parsed.date}\\n\\nSave this expense?`;
    const photoRes = await fetch(fileLink.toString());
    const photoBuffer = Buffer.from(await photoRes.arrayBuffer());
    await ctx.replyWithPhoto({ source: photoBuffer }, {
      caption: preview,
      parse_mode: 'Markdown',
      ...getConfirmationKeyboard()
    });
  } catch (error: unknown) {
    console.error('OCR photo handler error:', error);
    ctx.reply('❌ OCR processing failed. Please try again later.');
  }
});

// Handle callback queries for OCR confirmation
bot.action(/ocr_(yes|no)/, async (ctx) => {
  const userId = ctx.from.id.toString();
  const pending = pendingOCR.get(userId);
  if (!pending) {
    return ctx.answerCbQuery('No pending OCR result.', { show_alert: true });
  }
  if (ctx.match[1] === 'yes') {
    try {
      const transaction = await transactionService.addTransaction(
        userId,
        `${pending.amount} ${pending.description}`,
        'expense'
      );
      ctx.editMessageText(`✅ Expense saved!\\nAmount: ₹${transaction.amount}\\nDescription: ${transaction.description || 'N/A'}`);
      pendingOCR.delete(userId);
    } catch (error: unknown) {
      console.error('Save OCR expense error:', error);
      ctx.answerCbQuery('❌ Failed to save expense.', { show_alert: true });
    }
  } else {
    ctx.editMessageText('❌ OCR expense discarded.');
    pendingOCR.delete(userId);
  }
});

bot.launch().then(() => {
  console.log('🤖 Expense Tracker Bot started successfully');
}).catch((error) => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});