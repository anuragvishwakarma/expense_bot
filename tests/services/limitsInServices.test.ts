const state = { accounts: [{ id: 'a1', name: 'Wallet' }] as any[], inserted: [] as any[] };
jest.mock('../../src/db', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const b: any = {};
      for (const m of ['select', 'eq', 'order', 'limit', 'update']) b[m] = () => b;
      b.insert = (row: any) => { state.inserted.push({ table, row }); return b; };
      b.single = () => Promise.resolve({ data: { id: 'new', ...state.inserted.slice(-1)[0]?.row }, error: null });
      b.then = (res: any) => res({ data: table === 'accounts' ? state.accounts : [], error: null });
      return b;
    },
  }),
}));
import { AccountService } from '../../src/services/accountService';
import { GoalService } from '../../src/services/goalService';
import { DebtService } from '../../src/services/debtService';
import { BudgetService } from '../../src/services/budgetService';
import { RecurrenceService } from '../../src/services/recurrenceService';

beforeEach(() => { state.inserted.length = 0; });

describe('input limits reach the services', () => {
  it('accounts: refuses a duplicate name in any letter case, long names and silly balances', async () => {
    const s = new AccountService();
    await expect(s.createAccount('u1', 'wallet', 'cash')).rejects.toThrow('already have an account called "wallet"');
    await expect(s.createAccount('u1', ' WALLET ', 'cash')).rejects.toThrow('already have an account');
    await expect(s.createAccount('u1', 'x'.repeat(41), 'cash')).rejects.toThrow('too long');
    await expect(s.createAccount('u1', 'Bank', 'checking', 'INR', 1e12)).rejects.toThrow('too large');
    await expect(s.createAccount('u1', 'Bank', 'checking', 'INR', 100)).resolves.toBeTruthy();
    expect(state.inserted[0].row.name).toBe('Bank');
  });

  it('goals: friendly errors for huge targets, empty and long names, and bad progress', async () => {
    const s = new GoalService();
    await expect(s.createGoal('u1', 'Big', 99999999999)).rejects.toThrow('too large');
    await expect(s.createGoal('u1', '  ', 100)).rejects.toThrow('name');
    await expect(s.createGoal('u1', 'x'.repeat(41), 100)).rejects.toThrow('too long');
    await expect(s.updateProgress('g1', 'u1', -5)).rejects.toThrow('more than 0');
  });

  it('debts: caps the person name and note, and the amounts', async () => {
    const s = new DebtService();
    await expect(s.createDebt('u1', 'x'.repeat(41), 100, 'lend')).rejects.toThrow('too long');
    await expect(s.createDebt('u1', 'Sam', 100, 'lend', 'n'.repeat(101))).rejects.toThrow('100 characters');
    await expect(s.createDebt('u1', 'Sam', 0, 'lend')).rejects.toThrow('more than 0');
    await expect(s.settleDebt('d1', 'u1', 1e12)).rejects.toThrow('too large');
  });

  it('budgets: refuses a huge budget and caps a brand-new category name', async () => {
    const s = new BudgetService();
    await expect(s.setBudget('u1', 'Food', 1e12, 10, 2026)).rejects.toThrow('too large');
    await expect(s.setBudget('u1', 'Z'.repeat(500), 100, 10, 2026)).rejects.toThrow('too long');
  });

  it('recurring: checks amount, name and refuses per-minute schedules', async () => {
    const s = new RecurrenceService();
    await expect(s.create('u1', 1e12, 'Rent', 'expense', 1, 'month')).rejects.toThrow('too large');
    await expect(s.create('u1', 100, 'x'.repeat(41), 'expense', 1, 'month')).rejects.toThrow('too long');
    await expect(s.create('u1', 100, 'Spam', 'expense', undefined, undefined, undefined, undefined, '* * * * *')).rejects.toThrow('at least an hour');
  });

  it('recurring: a cron schedule is stored with a placeholder interval so the NOT NULL columns accept it', async () => {
    await new RecurrenceService().create('u1', 100, 'Monthly', 'expense', undefined, undefined, '2026-11-01', undefined, '0 9 1 * *');
    const row = state.inserted.find(i => i.table === 'recurrences')!.row;
    expect(row).toMatchObject({ cron_expression: '0 9 1 * *', interval_value: 1, interval_unit: 'day' });
  });
});
