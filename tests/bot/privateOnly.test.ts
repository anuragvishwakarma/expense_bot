import { Telegraf, Telegram } from 'telegraf';
import { privateOnly } from '../../src/bot/privateOnly';

function harness() {
  const calls: { method: string; payload: any }[] = [];
  jest.spyOn(Telegram.prototype, 'callApi').mockImplementation((async (method: string, payload: any) => {
    calls.push({ method, payload });
    return { message_id: 1, chat: { id: 1 }, date: 0 };
  }) as any);
  const bot = new Telegraf('123:test');
  bot.botInfo = { id: 1, is_bot: true, first_name: 'b', username: 'finbot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false } as any;
  const reached = jest.fn();
  bot.use(privateOnly());
  bot.use((_ctx, next) => { reached(); return next(); });
  const from = { id: 1, is_bot: false, first_name: 'u' };
  const msg = (type: string, text: string) => bot.handleUpdate({ update_id: 1, message: { message_id: 1, date: 0, chat: { id: type === 'private' ? 1 : -100, type }, from, text, entities: text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined } } as any);
  const tap = (type: string) => bot.handleUpdate({ update_id: 2, callback_query: { id: 'c', from, chat_instance: 'x', data: 'gl_list', message: { message_id: 1, date: 0, chat: { id: -100, type } } } } as any);
  return { calls, reached, msg, tap };
}

describe('privateOnly', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lets private chats through', async () => {
    const h = harness();
    await h.msg('private', '/today');
    expect(h.reached).toHaveBeenCalled();
    expect(h.calls).toHaveLength(0);
  });

  it('refuses commands in a group with a link to the private chat, and runs no handler', async () => {
    const h = harness();
    await h.msg('supergroup', '/today');
    expect(h.reached).not.toHaveBeenCalled();
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].payload.text).toContain('https://t.me/finbot');
  });

  it('stays silent on ordinary group chatter', async () => {
    const h = harness();
    await h.msg('group', 'lunch was 500');
    expect(h.reached).not.toHaveBeenCalled();
    expect(h.calls).toHaveLength(0);
  });

  it('answers button taps in a group with a toast and runs no handler', async () => {
    const h = harness();
    await h.tap('group');
    expect(h.reached).not.toHaveBeenCalled();
    expect(h.calls.map(c => c.method)).toEqual(['answerCallbackQuery']);
  });
});
