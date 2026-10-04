import { Markup } from 'telegraf';

export const chunk = <T,>(arr: T[], n: number) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const progressBar = (pct: number, width = 10) => {
  const filled = Math.round((Math.min(Math.max(pct, 0), 100) / 100) * width);
  return '▓'.repeat(filled) + '░'.repeat(width - filled);
};

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export const monthLabel = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });

// "500", "1,500", "₹2k", "1.5k" -> number; null when not a positive amount.
export function parseAmountInput(input: string): number | null {
  const m = input.trim().match(/^₹?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1);
  return n > 0 && isFinite(n) ? n : null;
}

// "9", "9:30", "21:05" -> "HH:MM" (24h); null when invalid.
export function parseTimeInput(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// YYYY-MM-DD that is a real calendar date, else null.
export function parseDateInput(input: string): string | null {
  const s = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

// Calendar date in IST (the bot's reminder timezone), offset by whole days.
export function istDate(offsetDays = 0, now = new Date()) {
  const d = new Date(now.getTime() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export const cancelRow = () => [Markup.button.callback('✖ Cancel', 'w:cancel')];
