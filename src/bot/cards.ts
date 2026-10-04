import { Markup, Telegraf } from 'telegraf';
import { BotContext } from './types';
import { Deps } from './wizards';
import { startWizard } from './wizard';
import { inr, monthLabel, progressBar, shiftMonth, istDate } from './ui';
import { todayIST } from '../utils/ist';
import { todayMessage, monthlyMessage, budgetStatusMessage } from './reports';

const btn = Markup.button.callback;
type Kb = ReturnType<typeof Markup.inlineKeyboard>;

// Openers for commands that still live in index.ts
export interface Legacy {
  accounts: (ctx: BotContext) => Promise<unknown>;
  recent: (ctx: BotContext) => Promise<unknown>;
  dashboard: (ctx: BotContext) => Promise<unknown>;
  help: (ctx: BotContext) => Promise<unknown>;
}

const uid = (ctx: BotContext) => ctx.session.user!.id;
const nowYM = () => {
  const [year, month] = istDate().split('-').map(Number);
  return { year, month };
};
const monthRange = (year: number, month: number) => {
  const mm = String(month).padStart(2, '0');
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}` };
};

export function buildMenuKeyboard() {
  return Markup.inlineKeyboard([
    [btn('➕ Expense', 'mn:add'), btn('💰 Income', 'mn:inc')],
    [btn('📊 Today', 'mn:today'), btn('📅 This month', 'mn:month')],
    [btn('🎯 Budget', 'mn:budget'), btn('🏁 Goals', 'mn:goals')],
    [btn('🤝 Debts', 'mn:debts'), btn('🔁 Recurring', 'mn:recur')],
    [btn('⏰ Reminder', 'mn:rem'), btn('💳 Accounts', 'mn:acc')],
    [btn('🧾 Recent', 'mn:recent'), btn('📄 Export', 'mn:export')],
    [btn('🌐 Dashboard', 'mn:dash'), btn('❓ Help', 'mn:help')],
  ]);
}

export function registerCards(bot: Telegraf<BotContext>, deps: Deps, legacy: Legacy) {
  // Edit the card in place when tapped from a button, else send a new message.
  const show = async (ctx: BotContext, text: string, kb?: Kb, edit = false, markdown = false) => {
    const extra = { ...(markdown ? { parse_mode: 'Markdown' as const } : {}), ...(kb ?? {}) };
    if (edit && ctx.callbackQuery) {
      try {
        return await ctx.editMessageText(text, extra as Parameters<BotContext['editMessageText']>[1]);
      } catch {
        // unchanged or too old: send a fresh card instead
      }
    }
    return ctx.reply(text, extra as Parameters<BotContext['reply']>[1]);
  };

  // Wrap handlers so a failure becomes a friendly message instead of a silent button.
  const safe = (fn: (ctx: BotContext) => Promise<unknown>) => async (ctx: BotContext) => {
    if (!ctx.session.user) {
      if (ctx.callbackQuery) await ctx.answerCbQuery();
      return ctx.reply('Please start the bot first with /start');
    }
    try {
      return await fn(ctx);
    } catch (error: unknown) {
      console.error('Card error:', error);
      if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
      return ctx.reply(`❌ ${error instanceof Error ? error.message : 'Something went wrong'}`);
    }
  };
  const act = (pattern: RegExp | string, fn: (ctx: BotContext & { match: RegExpExecArray }) => Promise<unknown>) =>
    bot.action(pattern, safe(async ctx => {
      await ctx.answerCbQuery();
      return fn(ctx as BotContext & { match: RegExpExecArray });
    }) as never);

  const confirmKb = (yes: string, no: string) =>
    Markup.inlineKeyboard([[btn('Yes, delete', yes), btn('Cancel', no)]]);

  // ---------- Menu ----------
  const openMenu = (ctx: BotContext, edit = false) => show(ctx, 'What would you like to do?', buildMenuKeyboard(), edit);

  // ---------- Reports ----------
  const todayCard = async (ctx: BotContext, edit = false) => {
    const { year, month } = nowYM();
    const today = todayIST(); // same IST date getDailySummary uses
    await show(ctx, await todayMessage(deps.reports, uid(ctx)), Markup.inlineKeyboard([
      [btn('📅 This month', `rp_m:${year}:${month}`), btn('📄 Export today', `ex:${today}:${today}`)],
    ]), edit, true);
  };

  const monthlyCard = async (ctx: BotContext, year: number, month: number, edit = false) => {
    const prev = shiftMonth(year, month, -1);
    const next = shiftMonth(year, month, 1);
    const cur = nowYM();
    const { start, end } = monthRange(year, month);
    const hasNext = next.year < cur.year || (next.year === cur.year && next.month <= cur.month);
    const nav = [
      btn(`‹ ${monthLabel(prev.year, prev.month)}`, `rp_m:${prev.year}:${prev.month}`),
      ...(hasNext ? [btn(`${monthLabel(next.year, next.month)} ›`, `rp_m:${next.year}:${next.month}`)] : []),
    ];
    await show(ctx, await monthlyMessage(deps.reports, uid(ctx), year, month), Markup.inlineKeyboard([
      nav,
      [btn('💰 Budget status', `bs:${year}:${month}`), btn('📄 Export', `ex:${start}:${end}`)],
    ]), edit, true);
  };

  const budgetStatusCard = async (ctx: BotContext, year: number, month: number, edit = false) => {
    const prev = shiftMonth(year, month, -1);
    const next = shiftMonth(year, month, 1);
    await show(ctx, await budgetStatusMessage(deps.budgets, uid(ctx), month, year), Markup.inlineKeyboard([
      [btn(`‹ ${monthLabel(prev.year, prev.month)}`, `bs:${prev.year}:${prev.month}`), btn(`${monthLabel(next.year, next.month)} ›`, `bs:${next.year}:${next.month}`)],
      [btn('➕ Set budget', 'bud_new'), btn('📅 Month report', `rp_m:${year}:${month}`)],
    ]), edit);
  };

  const exportPicker = (ctx: BotContext) => {
    const today = todayIST();
    const week = todayIST(-6);
    const { year, month } = nowYM();
    const last = shiftMonth(year, month, -1);
    const thisM = monthRange(year, month);
    const lastM = monthRange(last.year, last.month);
    return show(ctx, 'Export transactions as CSV for:', Markup.inlineKeyboard([
      [btn('Today', `ex:${today}:${today}`), btn('Last 7 days', `ex:${week}:${today}`)],
      [btn(`This month`, `ex:${thisM.start}:${thisM.end}`), btn('Last month', `ex:${lastM.start}:${lastM.end}`)],
      [btn('Custom range…', 'ex_custom')],
    ]));
  };

  // ---------- Goals ----------
  const goalsCard = async (ctx: BotContext, edit = false) => {
    const goals = await deps.goals.listGoals(uid(ctx));
    const rows = goals.map(g => {
      const pct = g.target_amount > 0 ? (g.saved_amount / g.target_amount) * 100 : 0;
      return [btn(`🎯 ${g.name} · ${pct.toFixed(0)}%`.slice(0, 60), `gl:${g.id}`)];
    });
    rows.push([btn('➕ New goal', 'gl_new')]);
    await show(ctx, goals.length ? '🏁 Your goals. Tap one to add savings or delete it:' : '🏁 No goals yet. Start one:', Markup.inlineKeyboard(rows), edit);
  };

  const goalDetail = async (ctx: BotContext, id: string) => {
    const g = (await deps.goals.listGoals(uid(ctx))).find(x => x.id === id);
    if (!g) return show(ctx, 'Goal not found.', undefined, true);
    const pct = g.target_amount > 0 ? (g.saved_amount / g.target_amount) * 100 : 0;
    await show(ctx, `🎯 ${g.name}\n${inr(g.saved_amount)} / ${inr(g.target_amount)}\n${progressBar(pct)} ${pct.toFixed(0)}%`, Markup.inlineKeyboard([
      [btn('➕ Add savings', `gl_add:${g.id}`), btn('🗑️ Delete', `gl_delask:${g.id}`)],
      [btn('« Back', 'gl_list')],
    ]), true);
  };

  // ---------- Debts ----------
  const debtsCard = async (ctx: BotContext, edit = false) => {
    const debts = (await deps.debts.listDebts(uid(ctx))).sort((a, b) => Number(a.settled) - Number(b.settled));
    const rows = debts.map(d => {
      const open = d.amount - d.settled_amount;
      const amount = !d.settled && d.settled_amount > 0 ? `${inr(open)} left of ${inr(d.amount)}` : inr(d.amount);
      return [btn(`${d.settled ? '✅' : '⏳'} ${d.type === 'lend' ? 'lent' : 'borrowed'} ${amount} · ${d.counterparty}`.slice(0, 60), `db:${d.id}`)];
    });
    rows.push([btn('💸 I lent', 'db_new:lend'), btn('🤲 I borrowed', 'db_new:borrow')]);
    await show(ctx, debts.length ? '🤝 Your debts. Tap one to settle or delete it:' : '🤝 No debts recorded. Add one:', Markup.inlineKeyboard(rows), edit);
  };

  const debtDetail = async (ctx: BotContext, id: string) => {
    const d = (await deps.debts.listDebts(uid(ctx))).find(x => x.id === id);
    if (!d) return show(ctx, 'Debt not found.', undefined, true);
    const left = d.amount - d.settled_amount;
    const text =
      `${d.type === 'lend' ? '💸 You lent' : '🤲 You borrowed'} ${inr(d.amount)} ${d.type === 'lend' ? 'to' : 'from'} ${d.counterparty}` +
      (d.description ? `\n"${d.description}"` : '') +
      `\nSettled ${inr(d.settled_amount)} · ${d.settled ? '✅ fully settled' : `${inr(left)} open`}`;
    await show(ctx, text, Markup.inlineKeyboard([
      [...(d.settled ? [] : [btn('✅ Settle', `db_settle:${d.id}`)]), btn('🗑️ Delete', `db_delask:${d.id}`)],
      [btn('« Back', 'db_list')],
    ]), true);
  };

  // ---------- Recurring ----------
  const recurCard = async (ctx: BotContext, edit = false) => {
    const recs = await deps.recurrences.listActive(uid(ctx));
    const every = (r: { cron_expression: string | null; interval_value: number | null; interval_unit: string | null }) =>
      r.cron_expression ? `cron ${r.cron_expression}` : `every ${r.interval_value} ${r.interval_unit}`;
    const rows = recs.map((r: { id: string; amount: number; description: string; type: string; cron_expression: string | null; interval_value: number | null; interval_unit: string | null }) =>
      [btn(`${r.type === 'income' ? '💰' : '💸'} ${inr(Number(r.amount))} ${r.description} · ${every(r)}`.slice(0, 60), `rc:${r.id}`)]);
    rows.push([btn('➕ New recurring', 'rc_new')]);
    await show(ctx, recs.length ? '🔁 Your recurring entries. Tap one to stop it:' : '🔁 Nothing recurring yet. Set up rent, salary, subscriptions…', Markup.inlineKeyboard(rows), edit);
  };

  // ---------- Reminder ----------
  const reminderCard = async (ctx: BotContext, edit = false) => {
    const pref = await deps.reminders.getPreference(uid(ctx));
    const on = !!pref?.enabled;
    const time = pref?.reminder_time ? String(pref.reminder_time).slice(0, 5) : '21:00';
    await show(ctx, on ? `⏰ Daily reminder is ON at ${time} IST.` : '⏰ Daily reminder is OFF.', Markup.inlineKeyboard([
      [on ? btn('🔕 Turn off', 'rem_off') : btn('🔔 Turn on', 'rem_on')],
      [btn('🕘 Change time', 'rem_time')],
    ]), edit);
  };

  // ---------- Actions ----------
  const menuActions: Record<string, (ctx: BotContext) => Promise<unknown>> = {
    add: ctx => startWizard(ctx, 'add_expense'),
    inc: ctx => startWizard(ctx, 'add_income'),
    today: ctx => todayCard(ctx),
    month: ctx => { const { year, month } = nowYM(); return monthlyCard(ctx, year, month); },
    budget: ctx => { const { year, month } = nowYM(); return budgetStatusCard(ctx, year, month); },
    goals: ctx => goalsCard(ctx),
    debts: ctx => debtsCard(ctx),
    recur: ctx => recurCard(ctx),
    rem: ctx => reminderCard(ctx),
    acc: legacy.accounts,
    recent: legacy.recent,
    export: ctx => exportPicker(ctx),
    dash: legacy.dashboard,
    help: legacy.help,
  };
  act(/^mn:(\w+)$/, ctx => menuActions[ctx.match[1]]?.(ctx) ?? Promise.resolve());

  act(/^rp_m:(\d+):(\d+)$/, ctx => monthlyCard(ctx, Number(ctx.match[1]), Number(ctx.match[2]), true));
  act(/^bs:(\d+):(\d+)$/, ctx => budgetStatusCard(ctx, Number(ctx.match[1]), Number(ctx.match[2]), true));
  act('bud_new', ctx => startWizard(ctx, 'budget'));
  act('ex_custom', ctx => startWizard(ctx, 'export_range'));
  act(/^ex:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/, async ctx => {
    const [, start, end] = ctx.match;
    const csv = await deps.reports.exportTransactionsCSV(uid(ctx), start, end);
    await ctx.replyWithDocument({ source: Buffer.from(csv), filename: `transactions_${start}_to_${end}.csv` }, { caption: `📄 Transactions ${start} to ${end}` });
  });

  act('gl_list', ctx => goalsCard(ctx, true));
  act('gl_new', ctx => startWizard(ctx, 'goal_new'));
  act(/^gl:(.+)$/, ctx => goalDetail(ctx, ctx.match[1]));
  act(/^gl_add:(.+)$/, async ctx => {
    const g = (await deps.goals.listGoals(uid(ctx))).find(x => x.id === ctx.match[1]);
    if (!g) return show(ctx, 'Goal not found.', undefined, true);
    return startWizard(ctx, 'goal_add', { goalId: g.id, goalName: g.name });
  });
  act(/^gl_delask:(.+)$/, ctx => show(ctx, 'Delete this goal? This cannot be undone.', confirmKb(`gl_delyes:${ctx.match[1]}`, 'gl_list'), true));
  act(/^gl_delyes:(.+)$/, async ctx => {
    await deps.goals.deleteGoal(ctx.match[1], uid(ctx));
    return goalsCard(ctx, true);
  });

  act('db_list', ctx => debtsCard(ctx, true));
  act(/^db_new:(lend|borrow)$/, ctx => startWizard(ctx, 'debt_new', { type: ctx.match[1] }));
  act(/^db:(.+)$/, ctx => debtDetail(ctx, ctx.match[1]));
  act(/^db_settle:(.+)$/, async ctx => {
    const d = (await deps.debts.listDebts(uid(ctx))).find(x => x.id === ctx.match[1]);
    if (!d) return show(ctx, 'Debt not found.', undefined, true);
    return startWizard(ctx, 'debt_settle', { debtId: d.id, counterparty: d.counterparty, remaining: d.amount - d.settled_amount });
  });
  act(/^db_delask:(.+)$/, ctx => show(ctx, 'Delete this debt? This cannot be undone.', confirmKb(`db_delyes:${ctx.match[1]}`, 'db_list'), true));
  act(/^db_delyes:(.+)$/, async ctx => {
    await deps.debts.deleteDebt(ctx.match[1], uid(ctx));
    return debtsCard(ctx, true);
  });

  act('rc_list', ctx => recurCard(ctx, true));
  act('rc_new', ctx => startWizard(ctx, 'recur_new'));
  act(/^rc:(.+)$/, async ctx => {
    const r = (await deps.recurrences.listActive(uid(ctx))).find((x: { id: string }) => x.id === ctx.match[1]);
    if (!r) return show(ctx, 'Recurring entry not found.', undefined, true);
    const when = r.cron_expression ? `cron ${r.cron_expression}` : `every ${r.interval_value} ${r.interval_unit}`;
    return show(ctx, `${r.type === 'income' ? '💰' : '💸'} ${inr(Number(r.amount))} · ${r.description}\n${when}${r.start_date ? ` · from ${r.start_date}` : ''}${r.end_date ? ` to ${r.end_date}` : ''}`, Markup.inlineKeyboard([
      [btn('🛑 Stop', `rc_stop:${r.id}`), btn('« Back', 'rc_list')],
    ]), true);
  });
  act(/^rc_stop:(.+)$/, async ctx => {
    await deps.recurrences.deactivate(ctx.match[1], uid(ctx));
    return recurCard(ctx, true);
  });

  act('rem_open', ctx => reminderCard(ctx, true));
  act('rem_time', ctx => startWizard(ctx, 'reminder_time'));
  const setReminder = (enabled: boolean) => async (ctx: BotContext) => {
    const pref = await deps.reminders.getPreference(uid(ctx));
    await deps.reminders.setPreference(uid(ctx), enabled, pref?.reminder_time ?? '21:00:00');
    return reminderCard(ctx, true);
  };
  act('rem_on', setReminder(true));
  act('rem_off', setReminder(false));

  // Command openers used by index.ts
  return {
    menu: safe(ctx => openMenu(ctx)),
    add: safe(ctx => startWizard(ctx, 'add_expense')),
    income: safe(ctx => startWizard(ctx, 'add_income')),
    budget: safe(ctx => startWizard(ctx, 'budget')),
    budgetStatus: (year: number, month: number) => safe(ctx => budgetStatusCard(ctx, year, month)),
    today: safe(ctx => todayCard(ctx)),
    monthly: (year: number, month: number) => safe(ctx => monthlyCard(ctx, year, month)),
    exportPicker: safe(ctx => exportPicker(ctx)),
    goals: safe(ctx => goalsCard(ctx)),
    debts: safe(ctx => debtsCard(ctx)),
    recur: safe(ctx => recurCard(ctx)),
    reminder: safe(ctx => reminderCard(ctx)),
    nowYM,
  };
}

export type Openers = ReturnType<typeof registerCards>;
