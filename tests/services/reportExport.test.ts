let rows: any[] = [];
let maxRows = 1000;
let exactCount = true;
const calls: unknown[] = [];
jest.mock('../../src/db', () => ({
  getSupabase: () => {
    const b: any = {};
    let range: [number, number] | undefined;
    for (const m of ['select', 'eq', 'gte', 'lte', 'order']) b[m] = () => b;
    b.range = (from: number, to: number) => { range = [from, to]; return b; };
    b.then = (res: any) => {
      calls.push(range);
      // Like PostgREST: honour .range() but never return more than the project's max_rows
      const slice = range ? rows.slice(range[0], Math.min(range[1] + 1, range[0] + maxRows)) : rows;
      return res({ data: slice, error: null, count: exactCount ? rows.length : null });
    };
    return { from: () => b };
  },
}));
import { ReportService } from '../../src/services/reportService';

const tx = (over: any = {}) => ({ date: '2026-10-04', amount: 500, type: 'expense', description: 'lunch', category: { name: 'Food & Dining' }, ...over });
const svc = new ReportService();
const lines = (csv: string) => csv.replace(/^﻿/, '').split('\n');

describe('exportTransactionsCSV', () => {
  beforeEach(() => { rows = [tx()]; maxRows = 1000; exactCount = true; calls.length = 0; });

  it('pages past the server row cap so the backup is complete', async () => {
    rows = Array.from({ length: 2500 }, (_, i) => tx({ description: `n${i}` }));
    const out = lines(await svc.exportTransactionsCSV('u1', '2026-10-01', '2026-10-31'));
    expect(out.length - 1).toBe(2500);
    expect(out[2500]).toContain('n2499');
    expect(calls.length).toBe(3);
  });

  it('keeps paging when the server cap is lower than the page size', async () => {
    maxRows = 400;
    rows = Array.from({ length: 1000 }, (_, i) => tx({ description: `n${i}` }));
    expect(lines(await svc.exportTransactionsCSV('u1', '2026-10-01', '2026-10-31')).length - 1).toBe(1000);
  });

  it('without a count, keeps going until a short page', async () => {
    exactCount = false;
    rows = Array.from({ length: 1500 }, (_, i) => tx({ description: `n${i}` }));
    expect(lines(await svc.exportTransactionsCSV('u1', '2026-10-01', '2026-10-31')).length - 1).toBe(1500);
  });

  it('starts with a UTF-8 BOM and a clear header', async () => {
    const csv = await svc.exportTransactionsCSV('u1', '2026-10-01', '2026-10-31');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines(csv)[0]).toBe('Date,Type,Amount (INR),Description,Category');
  });

  it('writes amounts as plain numbers a spreadsheet can sum, not "₹500" text', async () => {
    rows = [tx({ amount: 500 }), tx({ amount: 12.5, type: 'income', description: 'refund' })];
    const [, a, b] = lines(await svc.exportTransactionsCSV('u1', '2026-10-01', '2026-10-31'));
    expect(a).toBe('2026-10-04,Expense,500.00,lunch,Food & Dining');
    expect(b).toBe('2026-10-04,Income,12.50,refund,Food & Dining');
    expect(a + b).not.toContain('₹');
  });

  it('neutralises formulas in descriptions and category names', async () => {
    rows = [tx({ description: '=HYPERLINK("http://evil","x")', category: { name: '@SUM(1)' } })];
    const line = lines(await svc.exportTransactionsCSV('u1', '2026-10-01', '2026-10-31'))[1];
    expect(line).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(line.endsWith(",'@SUM(1)")).toBe(true);
  });

  it('keeps awkward descriptions in one field', async () => {
    rows = [tx({ description: 'a, "b"\nc' })];
    const csv = await svc.exportTransactionsCSV('u1', '2026-10-01', '2026-10-31');
    expect(csv).toContain('"a, ""b""\nc"');
  });

  it('refuses a reversed range with a clear message instead of an empty file', async () => {
    await expect(svc.exportTransactionsCSV('u1', '2026-12-01', '2026-01-01')).rejects.toThrow('start date is after the end date');
  });

  it('refuses dates that do not exist', async () => {
    await expect(svc.exportTransactionsCSV('u1', '2026-13-45', '2026-10-31')).rejects.toThrow('real dates');
    await expect(svc.exportTransactionsCSV('u1', '2026-10-01', '2026-02-30')).rejects.toThrow('real dates');
    await expect(svc.exportTransactionsCSV('u1', 'yesterday', 'today')).rejects.toThrow('real dates');
  });

  it('accepts a single-day range', async () => {
    await expect(svc.exportTransactionsCSV('u1', '2026-10-04', '2026-10-04')).resolves.toContain('lunch');
  });
});
