import Telegraf from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { UserService } from './services/userService';
import { initSupabase } from './db';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const supabase = SupabaseClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);
const userService = new UserService();

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

// Keep existing start command
bot.start((ctx) => ctx.reply('Welcome to Expense Tracker Bot! Use /help to see available commands.'));

bot.launch();