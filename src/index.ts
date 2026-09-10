import Telegraf from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { UserService } from './services/userService';
import { initSupabase } from './db';
import { TransactionService } from './services/transactionService';
import { ReportService } from './services/reportService';
import { BudgetService } from './services/budgetService';
import { RecurrenceService } from './services/recurrenceService';
import { ReminderService } from './services/reminderService';
import { OCRService } from './services/ocrService';
import { startWorker } from './worker';
import { HELP_MESSAGE, ERROR_MESSAGES } from './utils/helpMessages';
import axios from 'axios';
import { OCRService } from './services/ocrService';
import { extractFromOcrText } from './utils/extractFromOcrText';


dotenv.config();
const ocrService = new OCRService(process.env.OCR_API_KEY || '');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const supabase = SupabaseClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);
const userService = new UserService();
const transactionService = new TransactionService();
const reportService = new ReportService();
const budgetService = new BudgetService();
const recurrenceService = new RecurrenceService();
const reminderService = new ReminderService();
const ocrService = new OCRService();
// Pending OCR results map
const pendingOCR = new Map<string, { amount: number; description: string; date: string }>();

// Initialize Supabase in service
initSupabase(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

// Start background worker for recurrences and reminders
startWorker(bot);

// Middleware to attach user to context
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
    } catch (error) {
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
  } catch (error) {
    console.error('Add expense error:', error);
    ctx.reply(`❌ Error: ${error.message}`);
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
    } catch (error) {
      console.error('Add income error:', error);
      ctx.reply(`❌ Error: ${error.message}`);
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
  } catch (error) {
    console.error('Add income error:', error);
    ctx.reply(`❌ Error: ${error.message}`);
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
  } catch (error) {
    console.error('Today report error:', error);
    ctx.reply(`❌ Error generating report: ${error.message}`);
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
  } catch (error) {
    console.error('Monthly report error:', error);
    ctx.reply(`❌ Error generating report: ${error.message}`);
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
  } catch (error) {
    console.error('Export error:', error);
    ctx.reply(`❌ Error exporting data: ${error.message}`);
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
  } catch (error) {
    console.error('Set budget error:', error);
    ctx.reply(`❌ Error setting budget: ${error.message}`);
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
  } catch (error) {
    console.error('Budget status error:', error);
    ctx.reply(`❌ Error getting budget status: ${error.message}`);
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
        intervalValue,
        intervalUnit,
        startDate,
        endDate,
        cronExpression
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

// Reminder commands
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
      ctx.reply(`✅ Goal created!\\nName: ${goal.name}\\nTarget: ₹${goal.target_amount.toFixed(2)}`);
    } catch (error) {
      console.error('Create goal error:', error);
      ctx.reply(`❌ Error: ${error.message}`);
    }
  } else if (subcmd === 'list') {
    try {
      const goals = await goalService.listGoals(ctx.session.user.id);
      if (goals.length === 0) {
        return ctx.reply('📭 No goals set yet. Use /goal set to create one.');
      }
      let msg = '🎯 Your goals:\\n';
      for (const g of goals) {
        const progress = (g.saved_amount / g.target_amount) * 100;
        msg += `• ${g.name}: ₹${g.saved_amount.toFixed(2)} / ₹${g.target_amount.toFixed(2)} (${progress.toFixed(1)}%)\\n`;
      }
      ctx.reply(msg);
    } catch (error) {
      console.error('List goals error:', error);
      ctx.reply(`❌ Error: ${error.message}`);
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
      ctx.reply(`✅ Progress updated!\\n${updatedGoal.name}: ₹${updatedGoal.saved_amount.toFixed(2)} / ₹${updatedGoal.target_amount.toFixed(2)}`);
    } catch (error) {
      console.error('Update goal progress error:', error);
      ctx.reply(`❌ Error: ${error.message}`);
    }
  } else if (subcmd === 'delete' || subcmd === 'remove') {
    const goalId = parts[1];
    if (!goalId) {
      return ctx.reply('Usage: /goal delete <goal_id>');
    }
    try {
      await goalService.deleteGoal(goalId, ctx.session.user.id);
      ctx.reply(`🗑️ Goal deleted.`);
    } catch (error) {
      console.error('Delete goal error:', error);
      ctx.reply(`❌ Error: ${error.message}`);
    }
  } else {
    ctx.reply('Unknown goal command. Use set, list, progress, delete.');
  }
});

// Global error handling

// Export Excel command
bot.command('exportexcel', async (ctx) => {
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
    const excelBuffer = await exportService.exportTransactionsExcel(
      ctx.session.user.id,
      startDate,
      endDate
    );
    await ctx.replyWithDocument({
      source: excelBuffer,
      filename: `transactions_${startDate}_to_${endDate}.xlsx`
    }, {
      caption: `📊 Transaction Excel export from ${startDate} to ${endDate}`
    });
  } catch (error) {
    console.error('Export Excel error:', error);
    ctx.reply(`❌ Error exporting data to Excel: ${error.message}`);
  }
});

// Export PDF command
bot.command('exportpdf', async (ctx) => {
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
    const pdfBuffer = await exportService.exportTransactionsPdf(
      ctx.session.user.id,
      startDate,
      endDate
    );
    await ctx.replyWithDocument({
      source: pdfBuffer,
      filename: `transactions_${startDate}_to_${endDate}.pdf`
    }, {
      caption: `📄 Transaction PDF export from ${startDate} to ${endDate}`
    });
  } catch (error) {
    console.error('Export PDF error:', error);
    ctx.reply(`❌ Error exporting data to PDF: ${error.message}`);
  }
});

// Handle OCR confirmation callbacks
bot.action(/ocr_(yes|no)/, async (ctx) => {
  const userId = ctx.from.id;
  const pending = ocrPending.get(userId);
  if (!pending) {
    return ctx.reply('No pending OCR confirmation. Please send a receipt photo first.');
  }

  const action = ctx.match[1]; // 'yes' or 'no'

  if (action === 'no') {
    ocrPending.delete(userId);
    return ctx.reply('✅ Receipt discarded.');
  }

  // action === 'yes'
  if (pending.amount === null) {
    ocrPending.delete(userId);
    return ctx.reply('❌ Could not detect an amount from the receipt. Please use /add to enter the expense manually.');
  }

  // Build input string for transaction: amount + description (merchant and date)
  const descParts = [];
  if (pending.merchant) descParts.push(pending.merchant);
  if (pending.date) descParts.push(`(${pending.date})`);
  const description = descParts.join(' ');

  const input = `${pending.amount} ${description}`.trim();

  try {
    const transaction = await transactionService.addTransaction(
      userId,
      input,
      'expense'
    );

    ocrPending.delete(userId);
    ctx.reply(`✅ Expense saved from receipt!\nAmount: ₹${transaction.amount}\nDescription: ${transaction.description || 'N/A'}`);
  } catch (error) {
    console.error('Error saving OCR transaction:', error);
    ocrPending.delete(userId);
    ctx.reply(`❌ Error saving expense: ${error.message}`);
  }
});

bot.catch((err, ctx) => {
  console.error('Error in bot:', err);
  ctx.reply(ERROR_MESSAGES.GENERAL_ERROR);
});

// Production readiness
if (process.env.NODE_ENV === 'production') {
  import { configureProductionBot } from './production';
  configureProductionBot(bot);
}

// Helper to send confirmation keyboard
function getConfirmationKeyboard(): any {
  return {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          { text: '✅ Yes, save', callback_data: 'ocr_yes' },
          { text: '❌ No, cancel', callback_data: 'ocr_no' }
        ]
      ]
    })
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
    await ctx.replyWithPhoto({ source: await (await fetch(fileLink.toString())).buffer() }, {
      caption: preview,
      parse_mode: 'Markdown',
      ...getConfirmationKeyboard()
    });
  } catch (error) {
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
    } catch (error) {
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