const NUM = /^\d[\d,]*(\.\d+)?$/;
const toNum = (s: string) => parseFloat(s.replace(/,/g, ''));

// "/budget <category words> <amount> <month> [year]" -> parts, or null if malformed.
export function parseBudgetArgs(text: string, currentYear = new Date().getFullYear()) {
  const tokens = text.trim().split(/\s+/).slice(1);
  const n = tokens.length;
  const tail = (k: number) => tokens.slice(n - k).every(t => NUM.test(t));
  if (n >= 4 && tail(3) && toNum(tokens[n - 1]) >= 2020) {
    return { category: tokens.slice(0, n - 3).join(' '), amount: toNum(tokens[n - 3]), month: toNum(tokens[n - 2]), year: toNum(tokens[n - 1]) };
  }
  if (n >= 3 && tail(2)) {
    return { category: tokens.slice(0, n - 2).join(' '), amount: toNum(tokens[n - 2]), month: toNum(tokens[n - 1]), year: currentYear };
  }
  return null;
}

// Resolve user input like "food" to an existing category like "Food & Dining".
// Returns null when nothing matches (caller creates it); throws when ambiguous.
export function matchCategory(names: string[], input: string): string | null {
  const q = input.trim().toLowerCase();
  const exact = names.find(n => n.toLowerCase() === q);
  if (exact) return exact;
  // A mid-word hit ("bus" inside "Airbus") is not a match; the query must start the name or one of its words
  const atWordStart = new RegExp(`(^|[^a-z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const partial = names.filter(n => atWordStart.test(n.toLowerCase()));
  if (partial.length <= 1) return partial[0] ?? null;
  const prefixed = partial.filter(n => n.toLowerCase().startsWith(q));
  if (prefixed.length === 1) return prefixed[0];
  throw new Error(`"${input}" matches several categories: ${partial.join(', ')}. Be more specific.`);
}
