import { mdEscape } from '../../src/bot/ui';
import { todayMessage, monthlyMessage } from '../../src/bot/reports';

describe('mdEscape', () => {
  it('escapes every legacy-Markdown control character', () => {
    expect(mdEscape('a_b*c`d[e\\f')).toBe('a\\_b\\*c\\`d\\[e\\\\f');
  });
  it('leaves ordinary text alone', () => {
    expect(mdEscape('Food & Dining 2026-10')).toBe('Food & Dining 2026-10');
  });
  it('defuses an inline-link payload', () => {
    expect(mdEscape('[click](http://evil.example)')).toBe('\\[click](http://evil.example)');
  });
});

describe('report cards escape user-chosen category names', () => {
  const summary = {
    date: '2026-10-14', totalIncome: 0, totalExpense: 10, net: -10, transactionCount: 1,
    expenseByCategory: { 'my_cat*[x](http://evil.example)': 10 }, incomeByCategory: { 'in_come': 5 },
  };
  const reports = { getDailySummary: async () => summary, getMonthlySummary: async () => summary } as never;

  it('today', async () => {
    const m = await todayMessage(reports, 'u');
    expect(m).toContain('my\\_cat\\*\\[x](http://evil.example)');
    expect(m).toContain('in\\_come');
    expect(m).not.toMatch(/[^\\]\[x\]/);
  });
  it('monthly', async () => {
    const m = await monthlyMessage(reports, 'u', 2026, 10);
    expect(m).toContain('my\\_cat\\*\\[x](http://evil.example)');
  });
});
