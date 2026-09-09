import { Telegraf } from 'telegraf';

// Production-specific configurations
export function configureProductionBot(bot: Telegraf) {
  // Enable logging in production
  bot.use((ctx, next) => {
    const start = Date.now();
    return next().then(() => {
      const ms = Date.now() - start;
      console.log(`${ctx.updateType} - ${ms}ms`);
    });
  });
  
  // Add rate limiting if needed
  // Could integrate with telegraf-ratelimit or similar
  
  return bot;
}