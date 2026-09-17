export function parseAmount(input: string): { amount: number; currency: string; remainder: string } | null {
  const cleaned = input.trim();
  
  // Try patterns in order:
  // 1. Currency symbol before amount: $50 lunch, ₹500 dinner
  // 2. Amount then currency code: 50 USD lunch, 500 INR dinner
  // 3. Amount then symbol: 50$ lunch (less common)
  // 4. Just amount and description: 50 lunch
  
  const patterns = [
    // Symbol before amount: $50 lunch
    /^([$€£¥₹])\s*([\d,\.]+)\s*(.*)$/,
    // Amount then 3-letter code: 50 USD lunch
    /^([\d,\.]+)\s*([A-Z]{3})\s*(.*)$/,
    // Amount then symbol: 50$ lunch
    /^([\d,\.]+)\s*([$€£¥₹])\s*(.*)$/,
    // Just amount and description: 50 lunch
    /^([\d,\.]+)\s*(.*)$/
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let currency = '';
      let amountStr = '';
      let description = '';
      
      if (match[1] && match[1].match(/[$€£¥₹]/)) {
        // Symbol before amount (pattern 1)
        currency = match[1];
        amountStr = match[2].replace(/,/g, '');
        description = (match[3] || '').trim();
      } else if (match[2] && match[2].match(/[A-Z]{3}/)) {
        // Amount then 3-letter code (pattern 2)
        amountStr = match[1].replace(/,/g, '');
        currency = match[2];
        description = (match[3] || '').trim();
      } else if (match[2] && match[2].match(/[$€£¥₹]/)) {
        // Amount then symbol (pattern 3)
        amountStr = match[1].replace(/,/g, '');
        currency = match[2];
        description = (match[3] || '').trim();
      } else {
        // Just amount and description (pattern 4)
        amountStr = match[1].replace(/,/g, '');
        currency = '';
        description = (match[2] || '').trim();
      }
      
      // Default currency
      if (!currency) {
        currency = 'INR';
      } else if (currency.length === 1 && ['$','€','£','¥','₹'].includes(currency)) {
        const symbolMap: { [key: string]: string } = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR' };
        currency = symbolMap[currency];
      }
      
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) return null;
      return { amount, currency, remainder: description };
    }
  }
  
  return null;
}