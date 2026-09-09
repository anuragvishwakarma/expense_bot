import Telegraf from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { UserService } from './services/userService';
import { initSupabase } from './db';
import { TransactionService } from './services/transactionService';
import { ReportService } from './services/reportService';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const supabase = SupabaseClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);
const userService = new UserService();
const transactionService = new TransactionService();
const reportService = new ReportService();

// Initialize Supabase in service
initSupabase(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

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
    
    ctx.reply(`✅ Expense recorded!
Amount: ₹${transaction.amount}
Description: ${transaction.description || 'N/A'}`);
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
      
      ctx.reply(`✅ Income recorded!
Amount: ₹${transaction.amount}
Description: ${transaction.description || 'N/A'}`);
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
    
    ctx.reply(`✅ Income recorded!
Amount: ₹${transaction.amount}
Description: ${transaction.description || 'N/A'}`);
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
    let message = `📊 *${monthName} ${year} Summary*`\n\n`;
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

bot.launch();