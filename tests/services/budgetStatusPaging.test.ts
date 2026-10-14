// PostgREST caps responses at max_rows (1000 on Supabase); spent totals must still cover every expense.
let expenses: any[] = [];
jest.mock('../../src/db', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const b: any = {};
      let range: [number, number] | undefined;
      for (const m of ['select', 'eq', 'gte', 'lte', 'order']) b[m] = () => b;
      b.range = (from: number, to: number) => { range = [from, to]; return b; };
      b.then = (res: any) => table === 'budgets'
        ? res({ data: [{ amount: 50000, category: { name: 'Food', icon: '🍔' } }], error: null })
        : res({ data: expenses.slice(range![0], Math.min(range![1] + 1, range![0] + 1000)), error: null, count: expenses.length });
      return b;
    },
  }),
}));
import { BudgetService } from '../../src/services/budgetService';

describe('getBudgetStatus past the row cap', () => {
  it('counts all 2500 expenses toward spent', async () => {
    expenses = Array.from({ length: 2500 }, () => ({ amount: 10, category: { name: 'Food' } }));
    const status = await new BudgetService().getBudgetStatus('u1', 10, 2026);
    const food = status.find(b => b.category === 'Food')!;
    expect(food.spent).toBe(25000);
    expect(food.remaining).toBe(25000);
  });
});
