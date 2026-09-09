import Telegraf from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { UserService } from './services/userService';
import { initSupabase } from './db';
import { TransactionService } from './services/transactionService';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const supabase = SupabaseClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);
const userService = new UserService();
const transactionService = new TransactionService();

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

bot.launch();