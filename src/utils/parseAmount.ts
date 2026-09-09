export function parseAmount(input: string): { amount: number; remainder: string } | null {
  // Remove commas and extract number
  const cleaned = input.replace(/,/g, '');
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  
  if (!match) return null;
  
  return {
    amount: parseFloat(match[1]),
    remainder: match[2].trim()
  };
}