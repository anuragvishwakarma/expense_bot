// Shared input limits, so every entry point (typed command, card flow, recurring worker) gives the
// same readable error instead of a database failure ("numeric field overflow", "Unknown error").
export const MAX_AMOUNT = 99_999_999; // numeric(10,2) holds up to 99,999,999.99
export const MAX_NAME = 40; // account, goal, debt person, recurring name, category
export const MAX_NOTE = 100;

export function checkAmount(n: number, label = 'amount', { allowZero = false } = {}): number {
  if (!Number.isFinite(n) || n < 0 || (n === 0 && !allowZero)) throw new Error(`The ${label} must be more than 0.`);
  if (n > MAX_AMOUNT) throw new Error(`The ${label} is too large. The maximum is ₹9,99,99,999.`);
  return n;
}

export function checkName(value: string, label: string, max = MAX_NAME): string {
  const s = (value ?? '').trim();
  if (!s) throw new Error(`Please give the ${label} a name.`);
  if (s.length > max) throw new Error(`That ${label} is too long. The maximum is ${max} characters.`);
  return s;
}
