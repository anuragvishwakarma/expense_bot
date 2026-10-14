import { Telegraf, Telegram } from 'telegraf';
import { userRateLimit } from '../../src/bot/rateLimit';

function harness() {
  const calls: { method: string; payload: any }[] = [];
  jest.spyOn(Telegram.prototype, 'callApi').mockImplementation((async (method: string, payload: any) => {
    calls.push({ method, payload });
    return { message_id: 1, chat: { id: 1 }, date: 0 };
  }) as any);
  let clock = 1_000_000;
  const bot = new Telegraf('123:test');
  bot.botInfo = { id: 1, is_bot: true, first_name: 'b', username: 'finbot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false } as any;
  const reached = jest.fn();
  bot.use(userRateLimit(() => clock));
  bot.use((_ctx, next) => { reached(); return next(); });
  const base = (id: number) => ({ message_id: 1, date: 0, chat: { id, type: 'private' }, from: { id, is_bot: false, first_name: 'u' } });
  const text = (id: number, t: string) => bot.handleUpdate({ update_id: 1, message: { ...base(id), text: t, entities: t.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: t.split(' ')[0].length }] : undefined } } as any);
  const photo = (id: number) => bot.handleUpdate({ update_id: 1, message: { ...base(id), photo: [{ file_id: 'f', file_unique_id: 'u', width: 1, height: 1 }] } } as any);
  const voice = (id: number) => bot.handleUpdate({ update_id: 1, message: { ...base(id), voice: { file_id: 'v', file_unique_id: 'u', duration: 1 } } } as any);
  const tap = (id: number) => bot.handleUpdate({ update_id: 1, callback_query: { id: 'c', from: base(id).from, chat_instance: 'x', data: 'x', message: base(id) } } as any);
  return { calls, reached, text, photo, voice, tap, advance: (ms: number) => { clock += ms; } };
}

describe('userRateLimit', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lets normal use through untouched', async () => {
    const h = harness();
    for (let i = 0; i < 10; i++) await h.text(1, 'lunch 200');
    expect(h.reached).toHaveBeenCalledTimes(10);
    expect(h.calls).toHaveLength(0);
  });

  it('caps paid kinds (plain text) at 10/min, warns once, then drops silently', async () => {
    const h = harness();
    for (let i = 0; i < 25; i++) await h.text(1, 'lunch 200');
    expect(h.reached).toHaveBeenCalledTimes(10);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].payload.text).toContain('Slow down');
  });

  it('counts photos and voice notes as paid', async () => {
    const h = harness();
    for (let i = 0; i < 6; i++) { await h.photo(1); await h.voice(1); }
    expect(h.reached).toHaveBeenCalledTimes(10);
  });

  it('keeps commands out of the tight paid cap but under the loose 40/min cap', async () => {
    const h = harness();
    for (let i = 0; i < 40; i++) await h.text(1, '/today');
    expect(h.reached).toHaveBeenCalledTimes(40);
    await h.text(1, '/today');
    expect(h.reached).toHaveBeenCalledTimes(40);
    expect(h.calls).toHaveLength(1);
  });

  it('paid updates also burn the loose budget', async () => {
    const h = harness();
    for (let i = 0; i < 10; i++) await h.text(1, 'lunch 200'); // 10 paid
    for (let i = 0; i < 30; i++) await h.text(1, '/today'); // 30 free = 40 total
    await h.text(1, '/today');
    expect(h.reached).toHaveBeenCalledTimes(40);
  });

  it('is per sender: one flooder does not block another user', async () => {
    const h = harness();
    for (let i = 0; i < 30; i++) await h.text(1, 'lunch 200');
    await h.text(2, 'lunch 200');
    expect(h.reached).toHaveBeenCalledTimes(11);
  });

  it('resets after the window', async () => {
    const h = harness();
    for (let i = 0; i < 12; i++) await h.text(1, 'lunch 200');
    expect(h.reached).toHaveBeenCalledTimes(10);
    h.advance(60_001);
    await h.text(1, 'lunch 200');
    expect(h.reached).toHaveBeenCalledTimes(11);
  });

  it('answers a flooded button tap with a toast instead of a message', async () => {
    const h = harness();
    for (let i = 0; i < 41; i++) await h.tap(1);
    expect(h.reached).toHaveBeenCalledTimes(40);
    expect(h.calls.map(c => c.method)).toEqual(['answerCallbackQuery']);
  });
});
