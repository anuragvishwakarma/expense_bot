// PostgREST caps responses at max_rows (1000 on Supabase); totals must still cover every row.
let rows: any[] = [];
jest.mock('../../src/db', () => ({
  getSupabase: () => {
    const b: any = {};
    let range: [number, number] | undefined;
    for (const m of ['select', 'eq', 'gte', 'lte', 'order']) b[m] = () => b;
    b.range = (from: number, to: number) => { range = [from, to]; return b; };
    b.then = (res: any) => res({ data: rows.slice(range![0], Math.min(range![1] + 1, range![0] + 1000)), error: null, count: rows.length });
    return { from: () => b };
  },
}));
import { ReportService } from '../../src/services/reportService';

const svc = new ReportService();
const tx = (i: number, over: any = {}) => ({ amount: 10, type: 'expense', date: '2026-10-04', category: { name: i % 2 ? 'Food' : 'Travel' }, ...over });

describe('report summaries past the row cap', () => {
  it('monthly totals include all 2500 rows', async () => {
    rows = Array.from({ length: 2500 }, (_, i) => tx(i));
    const m = await svc.getMonthlySummary('u1', 2026, 10);
    expect(m.transactionCount).toBe(2500);
    expect(m.totalExpense).toBe(25000);
    expect(m.dailyBreakdown['2026-10-04'].expense).toBe(25000);
    expect(m.expenseByCategory).toEqual({ Food: 12500, Travel: 12500 });
  });

  it('daily totals include all 1200 rows and keep the transaction list whole', async () => {
    rows = Array.from({ length: 1200 }, (_, i) => tx(i, i === 0 ? { type: 'income', amount: 5 } : {}));
    const d = await svc.getDailySummary('u1', '2026-10-04');
    expect(d.totalIncome).toBe(5);
    expect(d.totalExpense).toBe(11990);
    expect(d.transactions).toHaveLength(1200);
  });
});
