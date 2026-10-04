// The bot's users are in India: "today", month boundaries, reminders and cron schedules all
// follow IST. The server runs in UTC, so never derive a date with toISOString() (it is the
// UTC date: wrong between 00:00 and 05:30 IST).
export const IST_TZ = 'Asia/Kolkata';

// Calendar date (YYYY-MM-DD) in IST, offset by whole days (negative = past).
export function todayIST(offsetDays = 0, now = new Date()): string {
  return new Date(now.getTime() + offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

// Midnight at the start of an IST calendar date, as a real instant.
export const startOfISTDay = (date: string): Date => new Date(`${date}T00:00:00+05:30`);

// True for a real YYYY-MM-DD calendar date (rejects 2026-13-45 and 2026-02-30).
export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
