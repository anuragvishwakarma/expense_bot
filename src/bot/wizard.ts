import { Markup, Telegraf } from 'telegraf';
import { BotContext } from './types';
import { chunk, cancelRow } from './ui';

type Kb = ReturnType<typeof Markup.inlineKeyboard>;
export type Data = Record<string, unknown>;

export interface Prompt {
  text: string;
  options?: { label: string; value: unknown }[];
  columns?: number;
  skip?: string; // label of a Skip button; the step's skipValue is stored
}

export interface Step {
  key: string;
  // Return a value to fill the step without asking (null counts as a value).
  auto?: (ctx: BotContext, data: Data) => Promise<unknown | undefined>;
  ask: (ctx: BotContext, data: Data) => Promise<Prompt> | Prompt;
  // Free-text answer. Omit to accept buttons only.
  text?: (input: string, data: Data) => { value: unknown } | { error: string };
  skipValue?: unknown;
}

export interface Result {
  text: string;
  kb?: Kb;
}

export interface Wizard {
  id: string;
  steps: Step[];
  finish: (ctx: BotContext, data: Data) => Promise<Result>;
}

const registry = new Map<string, Wizard>();

const send = async (ctx: BotContext, text: string, kb: Kb | undefined, edit: boolean) => {
  if (edit && ctx.callbackQuery) {
    try {
      return await ctx.editMessageText(text, kb);
    } catch {
      // "message is not modified" or message too old: fall through to a fresh message
    }
  }
  return kb ? ctx.reply(text, kb) : ctx.reply(text);
};

const expired = async (ctx: BotContext) => {
  await ctx.answerCbQuery();
  await send(ctx, 'That step expired. Start again from /menu.', undefined, true);
};

async function advance(ctx: BotContext, edit: boolean): Promise<unknown> {
  const w = ctx.session.wizard!;
  const def = registry.get(w.id)!;
  while (w.step < def.steps.length) {
    const step = def.steps[w.step];
    if (step.auto) {
      const v = await step.auto(ctx, w.data);
      if (v !== undefined) {
        w.data[step.key] = v;
        w.step++;
        continue;
      }
    }
    const p = await step.ask(ctx, w.data);
    w.options = (p.options ?? []).map(o => o.value);
    const rows = chunk(
      (p.options ?? []).map((o, i) => Markup.button.callback(o.label, `w:${w.step}:${i}`)),
      p.columns ?? 2
    );
    if (p.skip) rows.push([Markup.button.callback(p.skip, `w:${w.step}:skip`)]);
    rows.push(cancelRow());
    return send(ctx, p.text, Markup.inlineKeyboard(rows), edit);
  }
  ctx.session.wizard = undefined;
  let res: Result;
  try {
    res = await def.finish(ctx, w.data);
  } catch (error: unknown) {
    console.error(`Wizard ${w.id} failed:`, error);
    res = { text: `❌ ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
  return send(ctx, res.text, res.kb, edit);
}

export async function startWizard(ctx: BotContext, id: string, data: Data = {}) {
  ctx.session.pendingTransfer = undefined;
  ctx.session.pendingAccount = undefined;
  ctx.session.pendingEntry = undefined;
  ctx.session.wizard = { id, step: 0, data: { ...data }, options: [] };
  return advance(ctx, !!ctx.callbackQuery);
}

export function registerWizards(bot: Telegraf<BotContext>, wizards: Wizard[]) {
  wizards.forEach(w => registry.set(w.id, w));

  const answer = async (ctx: BotContext, stepIdx: number, pick: (w: NonNullable<BotContext['session']['wizard']>) => unknown) => {
    const w = ctx.session.wizard;
    if (!ctx.session.user || !w || !registry.has(w.id)) return expired(ctx);
    if (w.step !== stepIdx) return ctx.answerCbQuery('Already answered');
    w.data[registry.get(w.id)!.steps[w.step].key] = pick(w);
    w.step++;
    await ctx.answerCbQuery();
    return advance(ctx, true);
  };

  bot.action(/^w:(\d+):(\d+)$/, ctx => answer(ctx, Number(ctx.match[1]), w => w.options[Number(ctx.match[2])]));
  bot.action(/^w:(\d+):skip$/, ctx =>
    answer(ctx, Number(ctx.match[1]), w => registry.get(w.id)!.steps[w.step].skipValue)
  );
  bot.action('w:cancel', async ctx => {
    ctx.session.wizard = undefined;
    await ctx.answerCbQuery();
    await send(ctx, 'Cancelled.', undefined, true);
  });

  // Registered before the other text handlers so answers are not parsed as expenses.
  bot.on('text', async (ctx, next) => {
    const w = ctx.session.wizard;
    if (!ctx.session.user || !w) return next();
    const input = ctx.message.text.trim();
    if (input.startsWith('/')) {
      ctx.session.wizard = undefined; // any command cancels the flow
      return next();
    }
    const step = registry.get(w.id)?.steps[w.step];
    if (!step) {
      ctx.session.wizard = undefined;
      return next();
    }
    if (!step.text) return ctx.reply('Please tap one of the buttons above, or /menu to start over.');
    const r = step.text(input, w.data);
    if ('error' in r) return ctx.reply(r.error);
    w.data[step.key] = r.value;
    w.step++;
    return advance(ctx, false);
  });
}
