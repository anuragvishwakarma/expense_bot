import { parseAmountInput } from './ui';
import { checkAmount } from '../utils/limits';

// A transfer waits for the amount reply for this long. After that the pending state is dropped so a
// later, unrelated message is not swallowed as a transfer amount.
export const TRANSFER_TTL_MS = 5 * 60_000;

export const isTransferExpired = (pending: { at: number }, now = Date.now()) => now - pending.at > TRANSFER_TTL_MS;

// "10000", "1,500", "₹2k" -> number. Anything with extra words ("500 lunch") is refused, not guessed at.
export function readTransferAmount(text: string): { amount: number } | { error: string } {
  const amount = parseAmountInput(text);
  if (amount === null) return { error: 'Send a valid amount like 10000, or any /command to cancel.' };
  try {
    return { amount: checkAmount(amount) };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'That amount is not valid.' };
  }
}
