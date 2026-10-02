const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?';
const OPT_YEAR = '(?:,?\\s+(\\d{4}))?';

const iso = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/**
 * Pulls a date phrase ("yesterday", "2 days ago", "30 oct", "oct 30th", "on 30 oct 2025")
 * out of free text. Returns the YYYY-MM-DD date (IST) and the text without the phrase.
 * Returns date null when no phrase found. Day/month without a year never lands in the
 * future: it rolls back to last year.
 */
export function extractDate(text: string, now: Date = new Date()): { date: string | null; text: string } {
  const today = iso(now);
  const shift = (days: number) => iso(new Date(now.getTime() - days * 86400000));
  const strip = (m: RegExpMatchArray) => text.replace(m[0], ' ').replace(/\s+/g, ' ').trim();

  let m = text.match(/\b(?:the\s+)?day before yesterday\b/i);
  if (m) return { date: shift(2), text: strip(m) };

  m = text.match(/\btoday\b/i);
  if (m) return { date: today, text: strip(m) };

  m = text.match(/\byesterday\b/i);
  if (m) return { date: shift(1), text: strip(m) };

  m = text.match(/\b(\d{1,3})\s+days?\s+(?:ago|back)\b/i);
  if (m) return { date: shift(parseInt(m[1], 10)), text: strip(m) };

  const dayFirst = text.match(new RegExp(`\\b(?:on\\s+)?${DAY}\\s+(?:of\\s+)?${MON}${OPT_YEAR}`, 'i'));
  const monthFirst = text.match(new RegExp(`\\b(?:on\\s+)?${MON}\\s+${DAY}${OPT_YEAR}`, 'i'));
  m = dayFirst || monthFirst;
  if (m) {
    const [day, mon, year] = dayFirst
      ? [m[1], m[2], m[3]]
      : [m[2], m[1], m[3]];
    const month = MONTHS.indexOf(mon.toLowerCase());
    let y = year ? parseInt(year, 10) : parseInt(today.slice(0, 4), 10);
    const pad = (n: number) => String(n).padStart(2, '0');
    let date = `${y}-${pad(month + 1)}-${pad(parseInt(day, 10))}`;
    if (!year && date > today) date = `${y - 1}-${date.slice(5)}`;
    // reject impossible dates (31 feb) and explicit future dates
    const valid = new Date(`${date}T00:00:00Z`);
    if (!isNaN(valid.getTime()) && valid.toISOString().slice(0, 10) === date && date <= today) {
      return { date, text: strip(m) };
    }
  }

  return { date: null, text };
}
