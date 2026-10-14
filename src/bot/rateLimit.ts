import { Context } from 'telegraf';

// Anyone on Telegram can open this bot, and some updates cost real money (OpenRouter text parsing,
// OCR, voice transcription). Cap updates per sender: a loose limit on everything, a tight one on
// the paid kinds. The sender is told once per window; further updates are dropped silently.
// ponytail: in-memory, per-process fixed window. Resets on restart; fine for one bot process,
// move to a DB-backed counter if the bot ever runs on more than one instance.
const WINDOW_MS = 60_000;
const MAX_ALL = 40;
const MAX_PAID = 10;
const MAX_TRACKED = 10_000;

type Hits = Map<string, { count: number; resetAt: number }>;

// 'ok' | 'warn' (first update over the limit this window) | 'drop'
function hit(hits: Hits, key: string, max: number, now: number): 'ok' | 'warn' | 'drop' {
  if (hits.size > MAX_TRACKED) for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
  const e = hits.get(key);
  if (!e || now > e.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return 'ok';
  }
  e.count += 1;
  return e.count <= max ? 'ok' : e.count === max + 1 ? 'warn' : 'drop';
}

// Photos, voice notes and plain (non-command) text can reach a paid API.
function isPaid(ctx: Context): boolean {
  const m = ctx.message;
  if (!m) return false;
  if ('photo' in m || 'voice' in m) return true;
  return 'text' in m && !m.text.startsWith('/');
}

export function userRateLimit(now: () => number = Date.now) {
  const all: Hits = new Map();
  const paid: Hits = new Map();
  return async (ctx: Context, next: () => Promise<void>) => {
    if (!ctx.from) return next();
    const key = String(ctx.from.id);
    const t = now();
    const results = [hit(all, key, MAX_ALL, t), isPaid(ctx) ? hit(paid, key, MAX_PAID, t) : 'ok'];
    if (results.every(r => r === 'ok')) return next();
    if (results.includes('warn')) {
      const text = '⏳ Slow down a little. Try again in a minute.';
      if (ctx.callbackQuery) await ctx.answerCbQuery(text).catch(() => {});
      else await ctx.reply(text).catch(() => {});
    }
  };
}
