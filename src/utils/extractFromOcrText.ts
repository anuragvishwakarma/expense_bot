export interface OcrResult {
  amount: number | null;
  date: string | null; // YYYY-MM-DD if found
  merchant: string | null;
}

/**
 * Attempts to find a monetary amount, a date, and a merchant name from OCR text.
 * This is a simple heuristic; can be improved with regex patterns.
 */
export function extractFromOcrText(text: string): OcrResult {
  const result: OcrResult = { amount: null, date: null, merchant: null };

  // Normalize text
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Find amount: look for patterns like $1,234.56, ₹1,234.56, 1234.50, etc.
  // We'll look for numbers with optional commas and decimal, optionally preceded by currency symbol.
  const amountRegex = /(?:₹|\$|€|£|¥)?\s*([\d,]+\.?\d*)/g;
  let amountMatch;
  let maxAmount = 0;
  while ((amountMatch = amountRegex.exec(text)) !== null) {
    const numStr = amountMatch[1].replace(/,/g, '');
    const num = parseFloat(numStr);
    if (!isNaN(num) && num > maxAmount) {
      maxAmount = num;
    }
  }
  if (maxAmount > 0) {
    result.amount = maxAmount;
  }

  // Find date: look for patterns like DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
  const dateRegex = /\b(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{2}[-\/]\d{2}[-\/]\d{4})\b/g;
  const dateMatch = dateRegex.exec(text);
  if (dateMatch) {
    // Try to normalize to YYYY-MM-DD
    let dateStr = dateMatch[0];
    // Replace / with -
    dateStr = dateStr.replace(/\//g, '-');
    // If format is DD-MM-YYYY, convert to YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // Already YYYY-MM-DD
        result.date = dateStr;
      } else if (parts[2].length === 4) {
        // Assume DD-MM-YYYY
        result.date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }

  // Merchant: heuristically take the first line that is not amount or date and looks like a title
  // Simpler: take the first non-empty line that doesn't contain a number pattern
  for (const line of lines) {
    if (!/[\d.,]/.test(line) && line.length > 3) {
      result.merchant = line;
      break;
    }
  }

  return result;
}