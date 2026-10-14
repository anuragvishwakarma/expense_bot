let cats: { id: string; name: string }[] = [];
const inserted: unknown[] = [];
jest.mock('../../src/db', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const b: any = {};
      for (const m of ['select', 'eq', 'upsert']) b[m] = () => b;
      b.insert = (row: unknown) => { inserted.push({ table, row }); return b; };
      b.single = () => Promise.resolve({ data: { id: 'new' }, error: null });
      b.then = (res: any) => res({ data: table === 'categories' ? cats : [], error: null });
      return b;
    },
  }),
}));
import { BudgetService } from '../../src/services/budgetService';
import { MAX_CATEGORIES } from '../../src/utils/limits';

const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Category ${i}` }));
beforeEach(() => { inserted.length = 0; });

describe('/budget category cap', () => {
  it('refuses to create another category once the user is at the cap', async () => {
    cats = many(MAX_CATEGORIES);
    await expect(new BudgetService().setBudget('u', 'Brand New', 100, 10, 2026)).rejects.toThrow('already have');
    expect(inserted.filter((i: any) => i.table === 'categories')).toHaveLength(0);
  });

  it('still lets a user at the cap budget an existing category', async () => {
    cats = many(MAX_CATEGORIES);
    await expect(new BudgetService().setBudget('u', 'Category 7', 100, 10, 2026)).resolves.toBeTruthy();
  });

  it('creates a new category below the cap', async () => {
    cats = many(MAX_CATEGORIES - 1);
    await new BudgetService().setBudget('u', 'Brand New', 100, 10, 2026);
    expect(inserted.some((i: any) => i.table === 'categories')).toBe(true);
  });
});
