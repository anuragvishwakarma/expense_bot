import { Context } from 'telegraf';

// Financial data must never be posted into a group. Refuse everything outside a private chat
// (and tell the sender once, on commands) before any user lookup or handler runs.
export function privateOnly() {
  return async (ctx: Context, next: () => Promise<void>) => {
    if (!ctx.chat || ctx.chat.type === 'private') return next();
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('Open me in a private chat').catch(() => {});
      return;
    }
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    if (text?.startsWith('/')) {
      await ctx
        .reply(`🔒 Your money data is private, so I only work in a direct chat. Open me here: https://t.me/${ctx.botInfo.username}`)
        .catch(() => {});
    }
  };
}
