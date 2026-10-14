import { todayIST } from '../utils/ist';

// Receipt photos, voice notes and free-text parsing cost real money per call (ocr.space, Google
// Speech, OpenRouter), and Telegram accounts are free. Cap the paid calls each user can make per
// IST day. Typed commands such as /add stay free and unlimited.
// ponytail: in-memory, per process. Resets on restart (so a restart hands everyone a fresh 50) and
// is not shared across instances; move to a DB-backed counter if the bot ever scales out.
export const MAX_PAID_PER_DAY = 50;
const MAX_TRACKED = 10_000;

const used = new Map<string, { day: string; count: number }>();

// Takes one paid call from the user's budget for today. False means the budget is spent.
export function takePaidCall(userId: string, now: Date = new Date()): boolean {
  const day = todayIST(0, now);
  if (used.size > MAX_TRACKED) for (const [k, v] of used) if (v.day !== day) used.delete(k);
  const e = used.get(userId);
  if (!e || e.day !== day) {
    used.set(userId, { day, count: 1 });
    return true;
  }
  if (e.count >= MAX_PAID_PER_DAY) return false;
  e.count += 1;
  return true;
}

export const PAID_QUOTA_MESSAGE =
  `You have used today's ${MAX_PAID_PER_DAY} smart entries (receipt photos, voice notes and free-text parsing). ` +
  'They reset at midnight IST. You can still add entries by typing, for example /add 250 lunch.';
