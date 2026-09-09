import Telegraf from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const supabase = SupabaseClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

bot.start((ctx) => ctx.reply('Welcome to Expense Tracker Bot! Use /help to see available commands.'));

bot.launch();