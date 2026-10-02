import { Telegraf, Context, session, Markup } from 'telegraf';
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
import { AccountService, Account } from './services/accountService';
import { startWorker } from './worker';
import { HELP_MESSAGE, ERROR_MESSAGES } from './utils/helpMessages';
import axios from 'axios';
import { parseAmount } from './utils/parseAmount';
import { parseExpenseText, saveParsedItems, PARSE_FAILURE_MESSAGE, formatForAddTransaction } from './services/expenseParserService';
import { extractDate } from './utils/parseDate';
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
  // Button-driven /transfer flow state (in-memory, lost on restart)
  pendingTransfer?: { from: string; to?: string };
  // /account add wizard: type chosen, then name, then starting balance
  pendingAccount?: { type: string; name?: string };
  // Confirmation card for a free-text entry, waiting for Save / edits
  pendingEntry?: PendingEntry;
}

interface PendingEntry {
  amount: number;
  description: string; // may still contain a date phrase; addTransaction extracts it
  type: 'expense' | 'income';
  category: string | null;
  accountId: string;
}

interface BotContext extends Context {
  session: SessionData;
}

dotenv.config();
const ocrService = new OCRService();

const bot = new Telegraf<BotContext>(process.env.TELEGRAM_BOT_TOKEN || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
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
initSupabase(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

// Session middleware
bot.use(session({
  defaultSession() {
    return { user: null };
  }
}));

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
bot.start((ctx) => {
  if (ctx.payload === 'link') return sendLinkCode(ctx);
  return ctx.reply('Welcome to Expense Tracker Bot! Use /help to see available commands.');
});

// --- Button-driven account flows (no IDs or names to remember) ---
const accountButtons = (accounts: Account[], prefix: string) =>
  Markup.inlineKeyboard(
    accounts.map(a => [Markup.button.callback(`${a.name}  ₹${a.current_balance.toFixed(2)}`, `${prefix}:${a.id}`)])
  );

const startTransfer = async (ctx: BotContext) => {
  const accounts = await accountService.listAccounts(ctx.session.user!.id);
  if (accounts.length < 2) {
    return ctx.reply('You need at least 2 accounts. Create one with /account add <name> <type>');
  }
  ctx.session.pendingTransfer = undefined;
  ctx.session.pendingAccount = undefined;
  return ctx.reply('Transfer from which account?', accountButtons(accounts, 'tf_from'));
};

bot.command('transfer', async (ctx) => {
  if (!ctx.session.user) return ctx.reply('Please start the bot first with /start');
  await startTransfer(ctx);
});

bot.action('tf_start', async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.session.user) await startTransfer(ctx);
});

bot.action(/^tf_from:(.+)$/, async (ctx) => {
  if (!ctx.session.user) return ctx.answerCbQuery();
  const accounts = await accountService.listAccounts(ctx.session.user.id);
  const from = ctx.match[1];
  if (!accounts.some(a => a.id === from)) return ctx.answerCbQuery('Account not found');
  ctx.session.pendingTransfer = { from };
  await ctx.answerCbQuery();
  await ctx.editMessageText('Transfer to which account?', accountButtons(accounts.filter(a => a.id !== from), 'tf_to'));
});

bot.action(/^tf_to:(.+)$/, async (ctx) => {
  if (!ctx.session.user) return ctx.answerCbQuery();
  const pending = ctx.session.pendingTransfer;
  if (!pending) {
    await ctx.answerCbQuery();
    return ctx.reply('That transfer expired. Start again with /transfer');
  }
  const accounts = await accountService.listAccounts(ctx.session.user.id);
  const from = accounts.find(a => a.id === pending.from);
  const to = accounts.find(a => a.id === ctx.match[1]);
  if (!from || !to || from.id === to.id) return ctx.answerCbQuery('Account not found');
  pending.to = to.id;
  await ctx.answerCbQuery();
  await ctx.editMessageText(`${from.name} → ${to.name}\nHow much? Send an amount like 10000 (or any /command to cancel).`);
});

// Must sit before the other text handlers so the amount reply is not parsed as an expense
bot.on('text', async (ctx, next) => {
  const pending = ctx.session.pendingTransfer;
  if (!ctx.session.user || !pending?.to) return next();
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) {
    ctx.session.pendingTransfer = undefined;
    return next();
  }
  const amount = parseFloat(text.replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('Send a valid amount like 10000, or any /command to cancel.');
  }
  ctx.session.pendingTransfer = undefined;
  try {
    const { from, to } = await accountService.transfer(ctx.session.user.id, pending.from, pending.to, amount);
    ctx.reply(`✅ Transfer complete!\n${from.name} → ${to.name}: ₹${amount.toFixed(2)}`);
  } catch (error: unknown) {
    ctx.reply(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// --- /account add wizard ---
const ACCOUNT_TYPES: [string, string][] = [
  ['🏦 Bank (checking)', 'checking'],
  ['💰 Savings', 'savings'],
  ['💳 Credit card', 'credit'],
  ['💵 Cash', 'cash'],
  ['📈 Investment', 'investment'],
  ['Other', 'other']
];

const startAccountWizard = async (ctx: BotContext) => {
  ctx.session.pendingTransfer = undefined;
  ctx.session.pendingAccount = undefined;
  return ctx.reply(
    'What kind of account would you like to add?',
    Markup.inlineKeyboard(chunk(ACCOUNT_TYPES.map(([label, type]) => Markup.button.callback(label, `acc_type:${type}`)), 2))
  );
};

const finishAccount = async (ctx: BotContext, balance: number) => {
  const p = ctx.session.pendingAccount!;
  ctx.session.pendingAccount = undefined;
  try {
    const acc = await accountService.createAccount(ctx.session.user!.id, p.name!, p.type, 'INR', balance);
    return ctx.reply(`✅ Account created!\n${acc.name} (${acc.type}) · ₹${acc.current_balance.toFixed(2)}`);
  } catch (error: unknown) {
    console.error('Create account error:', error);
    return ctx.reply(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

bot.action('acc_add', async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.session.user) await startAccountWizard(ctx);
});

bot.action(/^acc_type:(.+)$/, async (ctx) => {
  const type = ctx.match[1];
  if (!ctx.session.user || !ACCOUNT_TYPES.some(([, t]) => t === type)) return ctx.answerCbQuery();
  ctx.session.pendingAccount = { type };
  await ctx.answerCbQuery();
  await ctx.editMessageText(`What should this ${type} account be called? Send a name, e.g. HDFC (or any /command to cancel).`);
});

bot.action('acc_bal_skip', async (ctx) => {
  await ctx.answerCbQuery();
  if (!ctx.session.user || !ctx.session.pendingAccount?.name) return;
  await finishAccount(ctx, 0);
});

// Must sit before the other text handlers so replies are not parsed as expenses
bot.on('text', async (ctx, next) => {
  const p = ctx.session.pendingAccount;
  if (!ctx.session.user || !p) return next();
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) {
    ctx.session.pendingAccount = undefined;
    return next();
  }
  if (!p.name) {
    if (text.length > 40) return ctx.reply('That name is too long (max 40 characters). Try a shorter one.');
    p.name = text;
    return ctx.reply(
      `Starting balance for ${p.name}? Send an amount like 20000, or tap Skip.`,
      Markup.inlineKeyboard([[Markup.button.callback('Skip (₹0)', 'acc_bal_skip')]])
    );
  }
  const balance = parseFloat(text.replace(/,/g, ''));
  if (!isFinite(balance) || balance < 0) return ctx.reply('Send a valid amount like 20000, or tap Skip.');
  return finishAccount(ctx, balance);
});

bot.action('acc_del', async (ctx) => {
  if (!ctx.session.user) return ctx.answerCbQuery();
  const accounts = await accountService.listAccounts(ctx.session.user.id);
  await ctx.answerCbQuery();
  await ctx.editMessageText('Delete which account?', accountButtons(accounts, 'acc_delask'));
});

bot.action(/^acc_delask:(.+)$/, async (ctx) => {
  if (!ctx.session.user) return ctx.answerCbQuery();
  const acc = await accountService.getAccount(ctx.match[1], ctx.session.user.id);
  await ctx.answerCbQuery();
  if (!acc) return ctx.editMessageText('Account not found.');
  await ctx.editMessageText(
    `Delete ${acc.name} (₹${acc.current_balance.toFixed(2)})? This cannot be undone.`,
    Markup.inlineKeyboard([[
      Markup.button.callback('Yes, delete', `acc_delyes:${acc.id}`),
      Markup.button.callback('Cancel', 'acc_cancel')
    ]])
  );
});

bot.action(/^acc_delyes:(.+)$/, async (ctx) => {
  if (!ctx.session.user) return ctx.answerCbQuery();
  await ctx.answerCbQuery();
  try {
    await accountService.deleteAccount(ctx.match[1], ctx.session.user.id);
    await ctx.editMessageText('🗑️ Account deleted.');
  } catch (error: unknown) {
    await ctx.editMessageText(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

bot.action('acc_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Cancelled.');
});

// --- Confirmation card for free-text entries ---
const chunk = <T,>(arr: T[], n: number) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const entryCard = async (userId: string, e: PendingEntry) => {
  const { date, text } = extractDate(e.description);
  const acc = await accountService.getAccount(e.accountId, userId);
  const when = date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : 'Today';
  const msg =
    `🧾 ${e.type === 'income' ? 'Income' : 'Expense'} ₹${e.amount.toLocaleString('en-IN')} · ${when}\n` +
    `${e.category ?? 'Uncategorized'} · ${acc?.name ?? 'Unknown account'}` +
    (text ? `\n"${text}"` : '');
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Save', 'en_save')],
    [Markup.button.callback('Change category', 'en_cat'), Markup.button.callback('Change account', 'en_acc')],
    [Markup.button.callback('✖ Cancel', 'en_cancel')]
  ]);
  return { msg, kb };
};

const showEntryCard = async (ctx: BotContext) => {
  const card = await entryCard(ctx.session.user!.id, ctx.session.pendingEntry!);
  await ctx.editMessageText(card.msg, card.kb);
};

const expired = async (ctx: BotContext) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('That entry expired. Send it again.');
};

bot.action('en_save', async (ctx) => {
  const entry = ctx.session.pendingEntry;
  if (!ctx.session.user || !entry) return expired(ctx);
  ctx.session.pendingEntry = undefined;
  await ctx.answerCbQuery();
  try {
    const t = await transactionService.addTransaction(
      ctx.session.user.id,
      formatForAddTransaction(entry.amount, entry.description),
      entry.type,
      entry.accountId,
      entry.category ?? undefined
    );
    await ctx.editMessageText(
      `✅ ${entry.type === 'income' ? 'Income' : 'Expense'} saved: ₹${t.amount} · ${t.category_name ?? 'Uncategorized'} · ${t.date}`,
      undoKeyboard(t.id)
    );
  } catch (error: unknown) {
    await ctx.editMessageText(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

bot.action('en_cancel', async (ctx) => {
  ctx.session.pendingEntry = undefined;
  await ctx.answerCbQuery();
  await ctx.editMessageText('Cancelled.');
});

bot.action('en_cat', async (ctx) => {
  const entry = ctx.session.pendingEntry;
  if (!ctx.session.user || !entry) return expired(ctx);
  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', ctx.session.user.id)
    .eq('type', entry.type)
    .order('name');
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    'Pick a category:',
    Markup.inlineKeyboard(chunk((data || []).map((c: { id: string; name: string }) => Markup.button.callback(c.name, `en_catset:${c.id}`)), 2))
  );
});

bot.action(/^en_catset:(.+)$/, async (ctx) => {
  const entry = ctx.session.pendingEntry;
  if (!ctx.session.user || !entry) return expired(ctx);
  const { data } = await supabase
    .from('categories')
    .select('name')
    .eq('id', ctx.match[1])
    .eq('user_id', ctx.session.user.id)
    .eq('type', entry.type)
    .single();
  if (!data) return ctx.answerCbQuery('Category not found');
  entry.category = data.name;
  await ctx.answerCbQuery();
  await showEntryCard(ctx);
});

bot.action('en_acc', async (ctx) => {
  if (!ctx.session.user || !ctx.session.pendingEntry) return expired(ctx);
  const accounts = await accountService.listAccounts(ctx.session.user.id);
  await ctx.answerCbQuery();
  await ctx.editMessageText('Which account?', accountButtons(accounts, 'en_accset'));
});

bot.action(/^en_accset:(.+)$/, async (ctx) => {
  const entry = ctx.session.pendingEntry;
  if (!ctx.session.user || !entry) return expired(ctx);
  const acc = await accountService.getAccount(ctx.match[1], ctx.session.user.id);
  if (!acc) return ctx.answerCbQuery('Account not found');
  entry.accountId = acc.id;
  await ctx.answerCbQuery();
  await showEntryCard(ctx);
});

// --- Undo / delete entries ---
const undoKeyboard = (transactionId: string) =>
  Markup.inlineKeyboard([[Markup.button.callback('↩️ Undo', `tx_undo:${transactionId}`)]]);

const RECENT_PAGE = 10;

// date = YYYY-MM-DD to show one day only, null for everything
const recentList = async (userId: string, page: number, date: string | null) => {
  const rows: any[] = (await transactionService.getTransactions(userId, {
    limit: RECENT_PAGE + 1, // one extra row tells us whether an Older page exists
    offset: page * RECENT_PAGE,
    ...(date && { startDate: date, endDate: date })
  })) ?? [];
  const hasMore = rows.length > RECENT_PAGE;
  const shown = rows.slice(0, RECENT_PAGE);
  if (shown.length === 0) return { msg: date ? `📭 No entries on ${date}.` : '📭 No entries yet.', kb: undefined };

  const d = date ?? '-';
  const buttons = shown.map(t => [Markup.button.callback(
    `${t.type === 'income' ? '+' : '−'}₹${t.amount} ${t.description || t.category?.name || ''} · ${t.date}`.slice(0, 60),
    `tx_view:${t.id}:${page}:${d}`
  )]);
  const nav = [
    ...(page > 0 ? [Markup.button.callback('« Newer', `tx_list:${page - 1}:${d}`)] : []),
    ...(hasMore ? [Markup.button.callback('Older »', `tx_list:${page + 1}:${d}`)] : [])
  ];
  if (nav.length) buttons.push(nav);
  const title = date ? `Entries on ${date}` : `Your entries (page ${page + 1})`;
  return { msg: `${title}. Tap one to delete it:`, kb: Markup.inlineKeyboard(buttons) };
};

bot.command('recent', async (ctx) => {
  if (!ctx.session.user) return ctx.reply('Please start the bot first with /start');
  const arg = ctx.message.text.substring(7).trim(); // e.g. "30 oct", "2 days ago", "yesterday"
  let date: string | null = null;
  if (arg) {
    date = extractDate(arg).date;
    if (!date) return ctx.reply("Couldn't read that date. Try /recent 30 oct, /recent 2 days ago or /recent yesterday");
  }
  const { msg, kb } = await recentList(ctx.session.user.id, 0, date);
  return kb ? ctx.reply(msg, kb) : ctx.reply(msg);
});

bot.action(/^tx_list:(\d+):(.+)$/, async (ctx) => {
  if (!ctx.session.user) return ctx.answerCbQuery();
  await ctx.answerCbQuery();
  const { msg, kb } = await recentList(ctx.session.user.id, parseInt(ctx.match[1], 10), ctx.match[2] === '-' ? null : ctx.match[2]);
  await ctx.editMessageText(msg, kb);
});

bot.action(/^tx_view:([^:]+):(\d+):(.+)$/, async (ctx) => {
  if (!ctx.session.user) return ctx.answerCbQuery();
  const t: any = await transactionService.getTransaction(ctx.session.user.id, ctx.match[1]);
  await ctx.answerCbQuery();
  if (!t) return ctx.editMessageText('Entry not found (already deleted?).');
  await ctx.editMessageText(
    `${t.type === 'income' ? 'Income' : 'Expense'} ₹${t.amount} · ${t.date}\n${t.category?.name ?? ''} · ${t.account?.name ?? ''}${t.description ? `\n"${t.description}"` : ''}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🗑️ Delete', `tx_delask:${t.id}`)],
      [Markup.button.callback('« Back', `tx_list:${ctx.match[2]}:${ctx.match[3]}`)]
    ])
  );
});

bot.action(/^tx_delask:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    'Delete this entry? The account balance is adjusted back.',
    Markup.inlineKeyboard([[
      Markup.button.callback('Yes, delete', `tx_undo:${ctx.match[1]}`),
      Markup.button.callback('Cancel', 'tx_list:0:-')
    ]])
  );
});

// Shared by the Undo button (right after saving) and the Yes-delete confirmation
bot.action(/^tx_undo:(.+)$/, async (ctx) => {
  if (!ctx.session.user) return ctx.answerCbQuery();
  await ctx.answerCbQuery();
  try {
    const t = await transactionService.deleteTransaction(ctx.session.user.id, ctx.match[1]);
    await ctx.editMessageText(`↩️ Removed ₹${t.amount} ${t.description ?? ''}. Balance adjusted.`.trim());
  } catch (error: unknown) {
    await ctx.editMessageText(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Dashboard link
bot.command('dashboard', (ctx) =>
  ctx.reply(
    'Open your dashboard and sign in with your email. Not linked yet? Use /link here to get a code for Settings.',
    Markup.inlineKeyboard([[
      Markup.button.url('🌐 Open dashboard', process.env.DASHBOARD_URL || 'https://dashboard-production-4c39.up.railway.app')
    ]])
  )
);

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

    ctx.reply(`✅ Expense recorded!\nAmount: ₹${transaction.amount}\nDescription: ${transaction.description || 'N/A'}`, undoKeyboard(transaction.id));
  } catch (error: unknown) {
    console.error('Add expense error:', error);
    ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
  }
});

// Add income command (using + prefix or /income)
bot.on('text', async (ctx, next) => {
  if (!ctx.session.user) return next();

  const text = ctx.message.text.trim();

  // Handle + income format
  if (text.startsWith('+')) {
    const amountText = text.substring(1).trim();
    if (!amountText) return next();

    try {
      const transaction = await transactionService.addTransaction(
        ctx.session.user.id,
        amountText,
        'income'
      );

      ctx.reply(`✅ Income recorded!\nAmount: ₹${transaction.amount}\nDescription: ${transaction.description || 'N/A'}`, undoKeyboard(transaction.id));
    } catch (error: unknown) {
      console.error('Add income error:', error);
      ctx.reply(`❌ Error: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`);
    }
    return;
  }

  // Natural-language expense entry: free text with a number in it, not a
  // command. Gated on OPENROUTER_API_KEY so the feature no-ops (falls to
  // next()) when the key isn't configured, matching today's behavior.
  if (!text.startsWith('/') && /\d/.test(text) && process.env.OPENROUTER_API_KEY) {
    const userId = ctx.session.user.id;

    const { data: categoryRows } = await supabase
      .from('categories')
      .select('name, type')
      .eq('user_id', userId);

    const namesOf = (type: string) =>
      (categoryRows || []).filter((c: { type: string }) => c.type === type).map((c: { name: string }) => c.name);

    const items = await parseExpenseText(text, namesOf('expense'), namesOf('income'));
    if (!items) return ctx.reply(PARSE_FAILURE_MESSAGE);

    // Several items: save directly as before. One item: show a confirmation card.
    if (items.length > 1) {
      const reply = await saveParsedItems(items, async (amount, description, categoryName) => {
        const transaction = await transactionService.addTransaction(
          userId,
          formatForAddTransaction(amount, description),
          'expense',
          undefined,
          categoryName
        );
        return { amount: transaction.amount, categoryName: transaction.category_name ?? null };
      });
      return ctx.reply(reply);
    }

    const defaultAccount = await accountService.getDefaultAccount(userId);
    if (!defaultAccount) {
      return ctx.reply('You have no account yet. Create one first with /account add <name> <type>');
    }
    const item = items[0];
    ctx.session.pendingEntry = {
      amount: item.amount,
      description: item.description,
      type: item.type ?? 'expense',
      category: item.category === 'Other' ? null : item.category,
      accountId: defaultAccount.id
    };
    const card = await entryCard(userId, ctx.session.pendingEntry);
    return ctx.reply(card.msg, card.kb);
  }

  return next();
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

    ctx.reply(`✅ Income recorded!\nAmount: ₹${transaction.amount}\nDescription: ${transaction.description || 'N/A'}`, undoKeyboard(transaction.id));
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
  const text = ctx.message.text.substring(6).trim(); // remove '/recur '
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
      ctx.reply(`✅ Daily reminder enabled at ${time} IST.`);
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
        msg += `• ${g.name}: ₹${g.saved_amount.toFixed(2)} / ₹${g.target_amount.toFixed(2)} (${progress.toFixed(1)}%) | ID: ${g.id}\n`;
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
        msg += ` | ID: ${d.id}\n`;
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
  const text = ctx.message.text.substring(9).trim(); // remove '/account '
  const parts = text.split(' ');
  const subcmd = parts[0];

  if (!subcmd) {
    try {
      const accounts = await accountService.listAccounts(ctx.session.user.id);
      if (accounts.length === 0) {
        return ctx.reply('📭 No accounts yet.', Markup.inlineKeyboard([[Markup.button.callback('➕ Add account', 'acc_add')]]));
      }
      const lines = accounts.map(a => `• ${a.name} (${a.type}): ₹${a.current_balance.toFixed(2)}`);
      return ctx.reply(
        `💳 Your accounts:\n${lines.join('\n')}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ Add account', 'acc_add')],
          [Markup.button.callback('🔁 Transfer', 'tf_start'), Markup.button.callback('🗑️ Delete', 'acc_del')]
        ])
      );
    } catch (error: unknown) {
      console.error('Account overview error:', error);
      return ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (subcmd === 'add') {
    // /account add <name> <type> [currency] [starting_balance]
    const name = parts[1];
    const type = parts[2];
    const currency = parts[3] || 'INR';
    const startBalance = parts[4] ? parseFloat(parts[4]) : 0;

    if (!name && !type) return startAccountWizard(ctx);
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
        msg += `• ${acc.name} (${acc.type}) [${acc.currency_code}]\n  Balance: ${acc.current_balance.toFixed(2)} | ID: ${acc.id}\n`;
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
      const { from, to } = await accountService.transfer(ctx.session.user.id, fromId, toId, amount);
      ctx.reply(`✅ Transfer complete!\n${from.name} → ${to.name}: ₹${amount.toFixed(2)}`);
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

// Link dashboard account command
const sendLinkCode = async (ctx: BotContext) => {
  if (!ctx.session.user) {
    return ctx.reply('Please start the bot first with /start');
  }
  try {
    const { code, expiresAt } = await userService.generateLinkCode(ctx.session.user.id);
    const expiresInMin = Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000);
    ctx.reply(`🔗 Your dashboard link code: ${code}\nEnter it on the dashboard's Settings page within ${expiresInMin} minutes.`);
  } catch (error: unknown) {
    console.error('Generate link code error:', error);
    ctx.reply(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};
bot.command('link', sendLinkCode);

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
    // Download here so the token-bearing file URL never leaves the bot
    const audioBuffer = Buffer.from(await (await fetch(fileLink.toString())).arrayBuffer());
    const transcription = await voiceService.transcribeVoice(audioBuffer);
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
    // Download here so the token-bearing file URL never leaves the bot
    const photoRes = await fetch(fileLink.toString());
    const photoBuffer = Buffer.from(await photoRes.arrayBuffer());
    const ocrResult = await ocrService.getOCRFromBuffer(photoBuffer);
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