// A tiny in-memory Supabase that honours .eq() filters on update, so compare-and-set is really exercised.
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};
let beforeUpdate: ((table: string) => void) | undefined; // simulates another request landing mid-way
let failUpdateFor: string | undefined; // row id whose update errors

jest.mock('../../src/db', () => ({
  getSupabase: () => ({
    from: (t: string) => {
      const filters: [string, unknown][] = [];
      let patch: Row | undefined;
      const match = () => tables[t].filter(r => filters.every(([c, v]) => r[c] === v));
      const run = () => {
        if (patch) {
          if (beforeUpdate) { const h = beforeUpdate; beforeUpdate = undefined; h(t); }
          const rows = match();
          if (rows.some(r => r.id === failUpdateFor)) return { data: null, error: { message: 'db down' } };
          rows.forEach(r => Object.assign(r, patch));
          return { data: rows.map(r => ({ ...r })), error: null };
        }
        return { data: match().map(r => ({ ...r })), error: null };
      };
      const b: any = {
        select: () => b,
        eq: (c: string, v: unknown) => { filters.push([c, v]); return b; },
        update: (p: Row) => { patch = p; return b; },
        single: () => { const r = run(); return Promise.resolve(r.data!.length ? { data: r.data![0], error: null } : { data: null, error: { code: 'PGRST116' } }); },
        then: (res: any) => res(run()),
      };
      return b;
    },
  }),
}));

import { AccountService } from '../../src/services/accountService';
import { GoalService } from '../../src/services/goalService';
import { DebtService } from '../../src/services/debtService';

const bal = (id: string) => tables.accounts.find(r => r.id === id)!.current_balance;

beforeEach(() => {
  beforeUpdate = undefined;
  failUpdateFor = undefined;
  tables.accounts = [
    { id: 'a', user_id: 'u', name: 'Wallet', current_balance: 1000 },
    { id: 'b', user_id: 'u', name: 'Bank', current_balance: 0 },
  ];
  tables.goals = [{ id: 'g', user_id: 'u', saved_amount: 100, target_amount: 1000 }];
  tables.debts = [{ id: 'd', user_id: 'u', amount: 500, settled_amount: 0, settled: false }];
});

describe('AccountService.adjustBalance', () => {
  it('applies the change and rounds to paise', async () => {
    await new AccountService().adjustBalance('a', 'u', -0.1 - 0.2);
    expect(bal('a')).toBe(999.7);
  });

  it('does not lose a change that lands between the read and the write', async () => {
    beforeUpdate = t => { if (t === 'accounts') tables.accounts[0].current_balance += 100; }; // another request adds 100
    await new AccountService().adjustBalance('a', 'u', -300);
    expect(bal('a')).toBe(800); // 1000 + 100 - 300, not 700
  });

  it('refuses a debit below the minimum and writes nothing', async () => {
    await expect(new AccountService().adjustBalance('a', 'u', -5000, 0)).rejects.toThrow('Insufficient balance');
    expect(bal('a')).toBe(1000);
  });

  it('will not touch another user\'s account', async () => {
    await expect(new AccountService().adjustBalance('a', 'someone-else', 10)).rejects.toThrow('not found');
    expect(bal('a')).toBe(1000);
  });
});

describe('AccountService.transfer', () => {
  it('moves money between the two accounts', async () => {
    await new AccountService().transfer('u', 'a', 'b', 400);
    expect([bal('a'), bal('b')]).toEqual([600, 400]);
  });

  it('refunds the debit when the credit fails, so no money disappears', async () => {
    failUpdateFor = 'b';
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(new AccountService().transfer('u', 'a', 'b', 400)).rejects.toMatchObject({ message: 'db down' });
    expect([bal('a'), bal('b')]).toEqual([1000, 0]);
    spy.mockRestore();
  });

  it('refuses when the source has too little, before moving anything', async () => {
    await expect(new AccountService().transfer('u', 'a', 'b', 5000)).rejects.toThrow('Insufficient balance');
    expect([bal('a'), bal('b')]).toEqual([1000, 0]);
  });
});

describe('goal and debt progress', () => {
  it('goal: keeps a concurrent contribution', async () => {
    beforeUpdate = () => { tables.goals[0].saved_amount += 50; };
    await new GoalService().updateProgress('g', 'u', 200);
    expect(tables.goals[0].saved_amount).toBe(350); // 100 + 50 + 200
  });

  it('debt: keeps a concurrent settlement and flags settled at the end', async () => {
    beforeUpdate = () => { tables.debts[0].settled_amount += 100; };
    await new DebtService().settleDebt('d', 'u', 400);
    expect(tables.debts[0]).toMatchObject({ settled_amount: 500, settled: true });
  });
});
