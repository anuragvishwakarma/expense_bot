export function parseAmount(input: string): { amount: number; currency: string; remainder: string } | null {
  // Remove spaces
  const cleaned = input.trim();
  // Match patterns: 
  // 1. Number with optional commas and decimal, then optional currency symbol or code, then rest description
  // Examples: "1,234.50USD coffee", "$12.50 lunch", "12.50 EUR dinner", "12.50 coffee"
  const match = cleaned.match(/^([\d,\.]+)\s*([A-Za-z$€£¥₹]*)\s*(.*)$/);
  if (!match) return null;
  let amountStr = match[1].replace(/,/g, '');
  let currency = match[2].toUpperCase();
  const description = match[3].trim();
  // If currency empty, default to INR (or could be empty meaning no currency)
  if (!currency) {
    currency = 'INR'; // default base currency
  } else if (currency.length === 1 && ['$','€','£','¥','₹'].includes(currency)) {
    // map symbols to ISO codes
    const symbolMap: { [key: string]: string } = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR' };
    currency = symbolMap[currency];
  }
  const amount = parseFloat(amountStr);
  if (isNaN(amount)) return null;
  return { amount, currency, remainder: description };
}