import { registerWizards, startWizard, Wizard } from '../../src/bot/wizard';

type Handler = (ctx: any, next?: () => unknown) => unknown;

function setup(wizard: Wizard) {
  const actions: [RegExp | string, Handler][] = [];
  const texts: Handler[] = [];
  const bot: any = {
    action: (p: RegExp | string, h: Handler) => actions.push([p, h]),
    on: (_: string, h: Handler) => texts.push(h),
  };
  registerWizards(bot, [wizard]);
  const sent: string[] = [];
  const ctx: any = {
    session: { user: { id: 'u1' }, wizard: undefined },
    callbackQuery: undefined,
    reply: async (t: string) => { sent.push(t); },
    editMessageText: async (t: string) => { sent.push(t); },
    answerCbQuery: async () => {},
  };
  const tap = async (data: string) => {
    for (const [p, h] of actions) {
      const m = typeof p === 'string' ? (p === data ? [data] : null) : data.match(p);
      if (m) { ctx.callbackQuery = {}; ctx.match = m; return h(ctx); }
    }
    throw new Error('no handler for ' + data);
  };
  const type = async (text: string) => {
    ctx.callbackQuery = undefined;
    ctx.message = { text };
    let passed = false;
    await texts[0](ctx, () => { passed = true; });
    return passed;
  };
  return { ctx, sent, tap, type };
}

const demo = (saved: unknown[]): Wizard => ({
  id: 'demo',
  steps: [
    { key: 'name', ask: () => ({ text: 'Name?' }), text: s => (s.length > 3 ? { error: 'too long' } : { value: s }) },
    { key: 'pick', ask: () => ({ text: 'Pick', options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }], skip: 'Skip' }), skipValue: 'none' },
    { key: 'auto', auto: async () => 'auto!', ask: () => ({ text: 'never shown' }) },
  ],
  finish: async (_ctx, data) => { saved.push(data); return { text: 'done' }; },
});

describe('wizard engine', () => {
  it('walks text, button and auto steps, then finishes', async () => {
    const saved: unknown[] = [];
    const t = setup(demo(saved));
    await startWizard(t.ctx, 'demo');
    expect(t.sent).toEqual(['Name?']);
    await t.type('abc');
    expect(t.sent[1]).toBe('Pick');
    await t.tap('w:1:1');
    expect(saved).toEqual([{ name: 'abc', pick: 'b', auto: 'auto!' }]);
    expect(t.sent[2]).toBe('done');
    expect(t.ctx.session.wizard).toBeUndefined();
  });
  it('re-asks on invalid text and supports skip', async () => {
    const saved: unknown[] = [];
    const t = setup(demo(saved));
    await startWizard(t.ctx, 'demo');
    await t.type('toolong');
    expect(t.sent[1]).toBe('too long');
    await t.type('ok');
    await t.tap('w:1:skip');
    expect(saved).toEqual([{ name: 'ok', pick: 'none', auto: 'auto!' }]);
  });
  it('cancels on any /command and passes it through', async () => {
    const t = setup(demo([]));
    await startWizard(t.ctx, 'demo');
    expect(await t.type('/today')).toBe(true);
    expect(t.ctx.session.wizard).toBeUndefined();
  });
  it('ignores stale buttons from an earlier step', async () => {
    const t = setup(demo([]));
    await startWizard(t.ctx, 'demo');
    await t.type('ab');
    await t.tap('w:0:0'); // step 0 already answered
    expect(t.ctx.session.wizard.step).toBe(1);
  });
});
