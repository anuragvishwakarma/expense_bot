import { SessionData, PendingEntry } from './types';
import { ParsedExpenseItem } from '../services/expenseParserService';

// The bot keeps five kinds of "waiting for the next message or tap" state in the session. Text
// handlers run in a fixed order, so a leftover slot from an abandoned flow can swallow the reply
// meant for a new one. Starting any flow clears all of them first.
export function clearPending(s: SessionData) {
  s.wizard = undefined;
  s.pendingTransfer = undefined;
  s.pendingAccount = undefined;
  s.pendingEntry = undefined;
  s.pendingBatch = undefined;
}

// A confirmation card is only good for a while; Save on an old card must not save a newer entry.
export const ENTRY_TTL_MS = 30 * 60_000;

export function liveEntry(s: SessionData, now = Date.now()): PendingEntry | undefined {
  const e = s.pendingEntry;
  if (e && now - e.at > ENTRY_TTL_MS) {
    s.pendingEntry = undefined;
    return undefined;
  }
  return e;
}

export function liveBatch(s: SessionData, now = Date.now()): { items: ParsedExpenseItem[]; at: number } | undefined {
  const b = s.pendingBatch;
  if (b && now - b.at > ENTRY_TTL_MS) {
    s.pendingBatch = undefined;
    return undefined;
  }
  return b;
}
