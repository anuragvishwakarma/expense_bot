import { SessionData, PendingEntry } from './types';

// The bot keeps four kinds of "waiting for the next message or tap" state in the session. Text
// handlers run in a fixed order, so a leftover slot from an abandoned flow can swallow the reply
// meant for a new one. Starting any flow clears all four first.
export function clearPending(s: SessionData) {
  s.wizard = undefined;
  s.pendingTransfer = undefined;
  s.pendingAccount = undefined;
  s.pendingEntry = undefined;
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
