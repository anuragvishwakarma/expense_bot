import type { Telegram } from 'telegraf';

// Errors worth a human's attention are DMed to the owner on Telegram, so a broken deploy or a
// failing worker is noticed without watching logs. Set ALERT_CHAT_ID to your numeric Telegram ID.
// Throttled, so one persistent failure sends one message per window, not one per minute.
const WINDOW_MS = 10 * 60 * 1000;
const lastSent = new Map<string, number>();

export function resetAlertThrottle() {
  lastSent.clear();
}

export async function alertOwner(telegram: Telegram, key: string, message: string, now = Date.now()): Promise<boolean> {
  const chatId = process.env.ALERT_CHAT_ID;
  if (!chatId) return false;
  const last = lastSent.get(key);
  if (last !== undefined && now - last < WINDOW_MS) return false;
  lastSent.set(key, now);
  try {
    // Plain text, trimmed: error messages may hold anything and Telegram caps a message at 4096
    await telegram.sendMessage(chatId, `🚨 ${key}\n${message}`.slice(0, 1000));
    return true;
  } catch (e) {
    console.error('Could not send alert:', e instanceof Error ? e.message : e);
    return false;
  }
}
