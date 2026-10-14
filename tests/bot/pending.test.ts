import { clearPending, liveEntry, liveBatch, ENTRY_TTL_MS } from '../../src/bot/pending';
import { SessionData } from '../../src/bot/types';

const entry = (at: number) => ({ amount: 10, description: 'x', type: 'expense' as const, category: null, accountId: 'a', at });
const busy = (): SessionData => ({
  user: null,
  wizard: { id: 'w', step: 0, data: {}, options: [] },
  pendingTransfer: { from: 'a', at: 1 },
  pendingAccount: { type: 'cash' },
  pendingEntry: entry(1),
  pendingBatch: { items: [], at: 1 },
});

describe('clearPending', () => {
  it('drops every waiting-for-a-reply slot so a stale one cannot swallow the next message', () => {
    const s = busy();
    clearPending(s);
    expect([s.wizard, s.pendingTransfer, s.pendingAccount, s.pendingEntry, s.pendingBatch]).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });

  it('leaves the signed-in user alone', () => {
    const s: SessionData = { ...busy(), user: { id: 'u', telegram_id: 1 } };
    clearPending(s);
    expect(s.user).toEqual({ id: 'u', telegram_id: 1 });
  });
});

describe('liveEntry', () => {
  it('returns a fresh entry', () => {
    const s: SessionData = { user: null, pendingEntry: entry(1000) };
    expect(liveEntry(s, 1000 + ENTRY_TTL_MS)).toBeDefined();
  });

  it('expires an old card and clears it, so Save on it cannot fire', () => {
    const s: SessionData = { user: null, pendingEntry: entry(1000) };
    expect(liveEntry(s, 1000 + ENTRY_TTL_MS + 1)).toBeUndefined();
    expect(s.pendingEntry).toBeUndefined();
  });

  it('returns undefined when there is none', () => {
    expect(liveEntry({ user: null })).toBeUndefined();
  });
});

describe('liveBatch', () => {
  it('expires an old batch so Save all on it cannot fire', () => {
    const s: SessionData = { user: null, pendingBatch: { items: [], at: 1000 } };
    expect(liveBatch(s, 1000 + ENTRY_TTL_MS)).toBeDefined();
    expect(liveBatch(s, 1000 + ENTRY_TTL_MS + 1)).toBeUndefined();
    expect(s.pendingBatch).toBeUndefined();
  });
});
