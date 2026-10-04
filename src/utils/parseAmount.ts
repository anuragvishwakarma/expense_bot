const SYMBOLS: Record<string, string> = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR' };
// Only real currency codes count, so "lunch at KFC" or "ATM" stay in the description.
const CODES = new Set(['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'CHF', 'CNY', 'HKD', 'NZD', 'SAR', 'ZAR', 'THB', 'MYR', 'KRW']);
const MULTIPLIER: Record<string, number> = { k: 1e3, cr: 1e7, crore: 1e7, lakh: 1e5, lac: 1e5 };

// "500 lunch", "₹1,500 rent", "2k rent", "1.5 lakh bonus", "50 USD lunch", "$10 coffee"
export function parseAmount(input: string): { amount: number; currency: string; remainder: string } | null {
  let s = input.trim();
  let currency = '';

  const lead = s.match(/^([$€£¥₹])\s*/);
  if (lead) {
    currency = SYMBOLS[lead[1]];
    s = s.slice(lead[0].length);
  }

  // Plain digits, or comma groups of 3 (1,500) or Indian 2-digit groups (1,00,000)
  const num = s.match(/^(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d+)?/);
  if (!num) return null;
  let rest = s.slice(num[0].length);
  if (/^[.,\d]/.test(rest)) return null; // "1..5" and similar typos

  let amount = parseFloat(num[0].replace(/,/g, ''));
  // 2k / 5cr attach to the number; "lakh"/"crore" may follow a space. A bare "L" is not
  // treated as lakh because "5L" is as likely to mean litres.
  const suffix = rest.match(/^(?:(k|cr)(?![a-z])|\s*(lakh|lac|crore)(?![a-z]))/i);
  if (suffix) {
    amount *= MULTIPLIER[(suffix[1] ?? suffix[2]).toLowerCase()];
    rest = rest.slice(suffix[0].length);
  }

  if (!currency) {
    const sym = rest.match(/^\s*([$€£¥₹])/);
    const code = rest.match(/^\s*([A-Za-z]{3})(?![A-Za-z])/);
    if (sym) {
      currency = SYMBOLS[sym[1]];
      rest = rest.slice(sym[0].length);
    } else if (code && CODES.has(code[1].toUpperCase())) {
      currency = code[1].toUpperCase();
      rest = rest.slice(code[0].length);
    }
  }

  if (isNaN(amount)) return null;
  return { amount: Math.round(amount * 100) / 100, currency: currency || 'INR', remainder: rest.trim() };
}
