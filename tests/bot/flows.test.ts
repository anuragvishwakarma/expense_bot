import { Telegraf, Telegram, session } from 'telegraf';
import { BotContext } from '../../src/bot/types';
import { registerWizards } from '../../src/bot/wizard';
import { buildWizards } from '../../src/bot/wizards';
import { registerCards } from '../../src/bot/cards';

// Drives the real Telegraf pipeline (commands, callback routing, keyboards) with a stubbed Telegram API.
function harness() {
  const calls: { method: string; payload: any }[] = [];
  const bot = new Telegraf<BotContext>('123:test');
  bot.botInfo = { id: 1, is_bot: true, first_name: 'b', username: 'b', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false } as any;
  // Telegraf builds a fresh Telegram client per update, so stub the prototype.
  jest.spyOn(Telegram.prototype, 'callApi').mockImplementation((async (method: string, payload: any) => {
    calls.push({ method, payload });
    return { message_id: 1, chat: { id: 1 }, date: 0 };
  }) as any);
  bot.use(session({ defaultSession: () => ({ user: null }) }));
  bot.use((ctx, next) => { ctx.session.user = { id: 'u1', telegram_id: 1 }; return next(); });

  const categories = ['Food & Dining', 'Transportation'];
  const query: any = { select: () => query, eq: () => query, order: async () => ({ data: categories.map(name => ({ name })) }) };
  const setBudget = jest.fn(async () => ({ budget: {}, categoryName: 'Food & Dining' }));
  const goals = [{ id: 'g1', name: 'Laptop', saved_amount: 2500, target_amount: 10000 }];
  const deps: any = {
    supabase: { from: () => query },
    budgets: { setBudget },
    goals: { listGoals: async () => goals, deleteGoal: jest.fn(async () => {}) },
    accounts: { listAccounts: async () => [] },
    undoKeyboard: () => undefined,
  };
  registerWizards(bot, buildWizards(deps));
  const cards = registerCards(bot, deps, { accounts: async () => {}, recent: async () => {}, dashboard: async () => {}, help: async () => {} });
  bot.command('budget', cards.budget);
  bot.command('goal', cards.goals);

  const from = { id: 1, is_bot: false, first_name: 'u' };
  const chat = { id: 1, type: 'private' };
  const message = (text: string) => bot.handleUpdate({ update_id: 1, message: { message_id: 1, date: 0, chat, from, text, entities: text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined } } as any);
  const tap = (data: string) => bot.handleUpdate({ update_id: 2, callback_query: { id: 'c', from, chat_instance: 'x', data, message: { message_id: 1, date: 0, chat } } } as any);
  const last = (method: string) => [...calls].reverse().find(c => c.method === method)!;
  const buttons = (c: { payload: any }) => (c.payload.reply_markup.inline_keyboard as any[][]).flat().map(b => b.callback_data);
  return { calls, message, tap, last, buttons, setBudget, deps };
}

describe('card flows through Telegraf', () => {
  it('/budget walks category -> amount -> month and saves', async () => {
    const h = harness();
    await h.message('/budget');
    expect(h.last('sendMessage').payload.text).toContain('Which category');
    expect(h.buttons(h.last('sendMessage'))).toEqual(expect.arrayContaining(['w:0:0', 'w:0:1', 'w:cancel']));

    await h.tap('w:0:0'); // Food & Dining
    expect(h.last('editMessageText').payload.text).toContain('Monthly budget for Food & Dining');

    await h.tap('w:1:2'); // ₹5,000 preset
    expect(h.last('editMessageText').payload.text).toBe('Which month?');

    await h.tap('w:2:0'); // this month
    expect(h.setBudget).toHaveBeenCalledWith('u1', 'Food & Dining', 5000, expect.any(Number), expect.any(Number));
    expect(h.last('editMessageText').payload.text).toContain('✅ Budget set for Food & Dining');
  });

  it('typed text answers a text step, and a /command cancels the flow', async () => {
    const h = harness();
    await h.message('/budget');
    await h.message('Transportation');
    expect(h.last('sendMessage').payload.text).toContain('Monthly budget for Transportation');
    await h.message('/goal');
    expect(h.last('sendMessage').payload.text).toContain('Your goals');
  });

  it('/goal lists goals as buttons and opens a detail card with add/delete', async () => {
    const h = harness();
    await h.message('/goal');
    expect(h.buttons(h.last('sendMessage'))).toEqual(['gl:g1', 'gl_new']);
    await h.tap('gl:g1');
    const detail = h.last('editMessageText');
    expect(detail.payload.text).toContain('Laptop');
    expect(detail.payload.text).toContain('25%');
    expect(h.buttons(detail)).toEqual(['gl_add:g1', 'gl_delask:g1', 'gl_list']);
    await h.tap('gl_delask:g1');
    expect(h.buttons(h.last('editMessageText'))).toEqual(['gl_delyes:g1', 'gl_list']);
    await h.tap('gl_delyes:g1');
    expect(h.deps.goals.deleteGoal).toHaveBeenCalledWith('g1', 'u1');
  });
});
