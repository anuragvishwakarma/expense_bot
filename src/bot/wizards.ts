import { Markup } from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import { BotContext } from './types';
import { Wizard, Step } from './wizard';
import { inr, monthLabel, parseAmountInput, parseDateInput, parseTimeInput, progressBar, shiftMonth, istDate } from './ui';
import { formatForAddTransaction } from '../services/expenseParserService';
import { TransactionService } from '../services/transactionService';
import { BudgetService } from '../services/budgetService';
import { GoalService } from '../services/goalService';
import { DebtService } from '../services/debtService';
import { RecurrenceService } from '../services/recurrenceService';
import { ReminderService } from '../services/reminderService';
import { ReportService } from '../services/reportService';
import { AccountService } from '../services/accountService';
import { AccountDeletionService } from '../services/accountDeletionService';

type Kb = ReturnType<typeof Markup.inlineKeyboard>;

export interface Deps {
  supabase: SupabaseClient;
  transactions: TransactionService;
  budgets: BudgetService;
  goals: GoalService;
  debts: DebtService;
  recurrences: RecurrenceService;
  reminders: ReminderService;
  reports: ReportService;
  accounts: AccountService;
  deletion: AccountDeletionService;
  undoKeyboard: (transactionId: string) => Kb;
}

const uid = (ctx: BotContext) => ctx.session.user!.id;
const btn = Markup.button.callback;
const presets = (values: number[]) => values.map(v => ({ label: inr(v), value: v }));

const amountText: Step['text'] = s => {
  const n = parseAmountInput(s);
  return n ? { value: n } : { error: 'Send a valid amount like 500, 1,500 or 1.5k.' };
};
const shortText = (max: number, what: string): Step['text'] => s =>
  s.length > max ? { error: `That ${what} is too long (max ${max} characters).` } : { value: s };

export function buildWizards(deps: Deps): Wizard[] {
  const categoryNames = async (ctx: BotContext, type: 'expense' | 'income') => {
    const { data } = await deps.supabase.from('categories').select('name').eq('user_id', uid(ctx)).eq('type', type).order('name');
    return (data ?? []).map((c: { name: string }) => c.name);
  };

  const budget: Wizard = {
    id: 'budget',
    steps: [
      {
        key: 'category',
        ask: async ctx => ({
          text: 'Which category is this budget for? Tap one, or type a name.',
          options: (await categoryNames(ctx, 'expense')).map(n => ({ label: n, value: n })),
        }),
        text: shortText(40, 'name'),
      },
      {
        key: 'amount',
        ask: (_ctx, d) => ({
          text: `Monthly budget for ${d.category}? Tap an amount or type your own.`,
          options: presets([1000, 2000, 5000, 10000, 20000, 50000]),
          columns: 3,
        }),
        text: amountText,
      },
      {
        key: 'when',
        ask: () => {
          const [y, m] = istDate().split('-').map(Number);
          const next = shiftMonth(y, m, 1);
          return {
            text: 'Which month?',
            options: [
              { label: `This month (${monthLabel(y, m)})`, value: { year: y, month: m } },
              { label: `Next month (${monthLabel(next.year, next.month)})`, value: next },
            ],
            columns: 1,
          };
        },
      },
    ],
    finish: async (ctx, d) => {
      const when = d.when as { year: number; month: number };
      const { categoryName } = await deps.budgets.setBudget(uid(ctx), d.category as string, d.amount as number, when.month, when.year);
      return {
        text: `✅ Budget set for ${categoryName}\n${monthLabel(when.year, when.month)}: ${inr(d.amount as number)}`,
        kb: Markup.inlineKeyboard([
          [btn('📊 View status', `bs:${when.year}:${when.month}`)],
          [btn('➕ Set another', 'bud_new')],
        ]),
      };
    },
  };

  const addEntry = (type: 'expense' | 'income'): Wizard => ({
    id: `add_${type}`,
    steps: [
      {
        key: 'amount',
        ask: () => ({ text: type === 'income' ? 'How much did you receive?' : 'How much did you spend?' }),
        text: amountText,
      },
      {
        key: 'category',
        ask: async ctx => ({
          text: 'Which category?',
          options: (await categoryNames(ctx, type)).map(n => ({ label: n, value: n })),
          skip: 'Skip',
        }),
        text: shortText(40, 'name'),
        skipValue: null,
      },
      {
        key: 'description',
        ask: () => ({ text: 'What was it for? (optional, e.g. "lunch with Sam")', skip: 'Skip' }),
        text: shortText(100, 'note'),
        skipValue: '',
      },
      {
        key: 'account',
        // One account: no question. None: finish() reports the helpful "create an account" error.
        auto: async ctx => {
          const accounts = await deps.accounts.listAccounts(uid(ctx));
          return accounts.length === 0 ? null : accounts.length === 1 ? accounts[0].id : undefined;
        },
        ask: async ctx => ({
          text: 'Which account?',
          options: (await deps.accounts.listAccounts(uid(ctx))).map(a => ({ label: `${a.name}  ${inr(a.current_balance)}`, value: a.id })),
          columns: 1,
        }),
      },
    ],
    finish: async (ctx, d) => {
      const t = await deps.transactions.addTransaction(
        uid(ctx),
        formatForAddTransaction(d.amount as number, (d.description as string) ?? ''),
        type,
        (d.account as string | null) ?? undefined,
        (d.category as string | null) ?? undefined
      );
      return {
        text: `✅ ${type === 'income' ? 'Income' : 'Expense'} saved: ${inr(Number(t.amount))} · ${t.category_name ?? 'Uncategorized'} · ${t.date}`,
        kb: deps.undoKeyboard(t.id),
      };
    },
  });

  const goalNew: Wizard = {
    id: 'goal_new',
    steps: [
      { key: 'name', ask: () => ({ text: 'What are you saving for? (e.g. Laptop, Goa trip)' }), text: shortText(40, 'name') },
      {
        key: 'target',
        ask: (_c, d) => ({ text: `Target amount for ${d.name}?`, options: presets([10000, 25000, 50000, 100000]) }),
        text: amountText,
      },
    ],
    finish: async (ctx, d) => {
      const g = await deps.goals.createGoal(uid(ctx), d.name as string, d.target as number);
      return { text: `✅ Goal created\n${g.name}: target ${inr(g.target_amount)}`, kb: Markup.inlineKeyboard([[btn('🏁 My goals', 'gl_list')]]) };
    },
  };

  const goalAdd: Wizard = {
    id: 'goal_add',
    steps: [
      {
        key: 'amount',
        ask: (_c, d) => ({ text: `How much did you save towards ${d.goalName}?`, options: presets([500, 1000, 2000, 5000]) }),
        text: amountText,
      },
    ],
    finish: async (ctx, d) => {
      const g = await deps.goals.updateProgress(d.goalId as string, uid(ctx), d.amount as number);
      const pct = g.target_amount > 0 ? (g.saved_amount / g.target_amount) * 100 : 0;
      return {
        text: `✅ ${g.name}: ${inr(g.saved_amount)} / ${inr(g.target_amount)}\n${progressBar(pct)} ${pct.toFixed(0)}%${pct >= 100 ? '\n🎉 Goal reached!' : ''}`,
        kb: Markup.inlineKeyboard([[btn('🏁 My goals', 'gl_list')]]),
      };
    },
  };

  const debtNew: Wizard = {
    id: 'debt_new',
    steps: [
      {
        key: 'counterparty',
        ask: (_c, d) => ({ text: d.type === 'lend' ? 'Who did you lend to?' : 'Who did you borrow from?' }),
        text: shortText(40, 'name'),
      },
      { key: 'amount', ask: (_c, d) => ({ text: `How much ${d.type === 'lend' ? 'did you lend' : 'did you borrow'}?` }), text: amountText },
      { key: 'description', ask: () => ({ text: 'Add a note? (optional)', skip: 'Skip' }), text: shortText(100, 'note'), skipValue: '' },
    ],
    finish: async (ctx, d) => {
      const debt = await deps.debts.createDebt(uid(ctx), d.counterparty as string, d.amount as number, d.type as 'lend' | 'borrow', (d.description as string) || null);
      return {
        text: `✅ Recorded: you ${d.type === 'lend' ? 'lent' : 'borrowed'} ${inr(debt.amount)} ${d.type === 'lend' ? 'to' : 'from'} ${debt.counterparty}`,
        kb: Markup.inlineKeyboard([[btn('🤝 My debts', 'db_list')]]),
      };
    },
  };

  const debtSettle: Wizard = {
    id: 'debt_settle',
    steps: [
      {
        key: 'amount',
        ask: (_c, d) => ({
          text: `${d.counterparty}: ${inr(d.remaining as number)} still open. How much was settled?`,
          options: [{ label: `Full ${inr(d.remaining as number)}`, value: d.remaining }],
          columns: 1,
        }),
        text: amountText,
      },
    ],
    finish: async (ctx, d) => {
      const debt = await deps.debts.settleDebt(d.debtId as string, uid(ctx), d.amount as number);
      return {
        text: `✅ ${debt.counterparty}: ${inr(debt.settled_amount)} / ${inr(debt.amount)} settled`,
        kb: Markup.inlineKeyboard([[btn('🤝 My debts', 'db_list')]]),
      };
    },
  };

  const recurNew: Wizard = {
    id: 'recur_new',
    steps: [
      {
        key: 'type',
        ask: () => ({ text: 'What repeats?', options: [{ label: '💸 Expense (rent, EMI…)', value: 'expense' }, { label: '💰 Income (salary…)', value: 'income' }], columns: 1 }),
      },
      { key: 'amount', ask: () => ({ text: 'How much each time?' }), text: amountText },
      { key: 'description', ask: () => ({ text: 'What is it called? (e.g. Rent, Netflix)' }), text: shortText(40, 'name') },
      {
        key: 'unit',
        ask: () => ({
          text: 'How often?',
          options: [{ label: 'Daily', value: 'day' }, { label: 'Weekly', value: 'week' }, { label: 'Monthly', value: 'month' }],
          columns: 3,
        }),
      },
      {
        key: 'start',
        ask: () => ({
          text: 'First date? Tap one, or type a date like 2026-11-01.',
          options: [
            { label: 'Today', value: istDate(0) },
            { label: 'Tomorrow', value: istDate(1) },
            { label: 'In a week', value: istDate(7) },
          ],
          columns: 3,
        }),
        text: s => {
          const d = parseDateInput(s);
          return d ? { value: d } : { error: 'Send a date as YYYY-MM-DD, e.g. 2026-11-01.' };
        },
      },
    ],
    finish: async (ctx, d) => {
      await deps.recurrences.create(uid(ctx), d.amount as number, d.description as string, d.type as 'expense' | 'income', 1, d.unit as 'day' | 'week' | 'month', d.start as string);
      return {
        text: `✅ Recurring ${d.type} set\n${inr(d.amount as number)} · ${d.description} · every ${d.unit}\nFirst entry: ${d.start}`,
        kb: Markup.inlineKeyboard([[btn('🔁 My recurring', 'rc_list')]]),
      };
    },
  };

  const reminderTime: Wizard = {
    id: 'reminder_time',
    steps: [
      {
        key: 'time',
        ask: () => ({
          text: 'What time (IST) should I remind you each day? Tap one, or type a time like 20:30.',
          options: ['08:00', '12:00', '18:00', '21:00', '22:00'].map(t => ({ label: t, value: t })),
          columns: 3,
        }),
        text: s => {
          const t = parseTimeInput(s);
          return t ? { value: t } : { error: 'Send a time like 21:00 (24-hour).' };
        },
      },
    ],
    finish: async (ctx, d) => {
      await deps.reminders.setPreference(uid(ctx), true, `${d.time}:00`);
      return { text: `✅ Daily reminder on at ${d.time} IST.`, kb: Markup.inlineKeyboard([[btn('⏰ Reminder settings', 'rem_open')]]) };
    },
  };

  const exportRange: Wizard = {
    id: 'export_range',
    steps: [
      {
        key: 'start',
        ask: () => ({ text: 'Start date? Type it as YYYY-MM-DD, e.g. 2026-10-01.' }),
        text: s => {
          const d = parseDateInput(s);
          return d ? { value: d } : { error: 'Send a date as YYYY-MM-DD.' };
        },
      },
      {
        key: 'end',
        ask: () => ({ text: 'End date? Type it as YYYY-MM-DD, or tap for the same day.', skip: 'Same day' }),
        text: s => {
          const d = parseDateInput(s);
          return d ? { value: d } : { error: 'Send a date as YYYY-MM-DD.' };
        },
        skipValue: null,
      },
    ],
    finish: async (ctx, d) => {
      const start = d.start as string;
      const end = (d.end as string | null) ?? start;
      if (end < start) return { text: '❌ The end date is before the start date. Try again from /export.' };
      const csv = await deps.reports.exportTransactionsCSV(uid(ctx), start, end);
      await ctx.replyWithDocument({ source: Buffer.from(csv), filename: `transactions_${start}_to_${end}.csv` }, { caption: `📄 Transactions ${start} to ${end}` });
      return { text: '📄 Export ready.' };
    },
  };

  const txCategory: Wizard = {
    id: 'tx_category',
    steps: [
      {
        key: 'category',
        ask: async (ctx, d) => ({
          text: 'File this entry under which category? Tap one, or type a name.',
          options: (await categoryNames(ctx, d.type as 'expense' | 'income')).map(n => ({ label: n, value: n })),
        }),
        text: shortText(40, 'name'),
      },
    ],
    finish: async (ctx, d) => {
      const name = await deps.transactions.setCategory(uid(ctx), d.txId as string, d.category as string);
      return { text: `✅ Filed under ${name}.` };
    },
  };

  const deleteAll: Wizard = {
    id: 'delete_all',
    steps: [
      {
        key: 'confirm',
        ask: () => ({ text: 'To permanently delete everything, type DELETE (in capitals). Or tap Cancel.' }),
        text: s => (s === 'DELETE' ? { value: true } : { error: 'Type DELETE in capitals to confirm, or tap Cancel.' }),
      },
    ],
    finish: async ctx => {
      const { loginDeleted } = await deps.deletion.deleteEverything(uid(ctx));
      ctx.session.user = null; // the next message starts a brand-new empty profile
      return {
        text: `🗑️ All your data is deleted${loginDeleted ? ', including your dashboard login' : ''}. Nothing is kept.\nIf you message me again I will start a fresh, empty profile.`,
      };
    },
  };

  return [deleteAll, txCategory, budget, addEntry('expense'), addEntry('income'), goalNew, goalAdd, debtNew, debtSettle, recurNew, reminderTime, exportRange];
}
