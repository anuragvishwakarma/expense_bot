import { parseBudgetArgs, matchCategory } from '../../src/utils/parseBudget';

describe('parseBudgetArgs', () => {
  it('parses a one-word category with year', () => {
    expect(parseBudgetArgs('/budget Food 5000 9 2026')).toEqual({ category: 'Food', amount: 5000, month: 9, year: 2026 });
  });
  it('defaults the year when omitted', () => {
    expect(parseBudgetArgs('/budget Food 5,000 9', 2030)).toEqual({ category: 'Food', amount: 5000, month: 9, year: 2030 });
  });
  it('keeps multi-word categories, including symbols and digits', () => {
    expect(parseBudgetArgs('/budget Bills & Utilities 3000 10 2026')?.category).toBe('Bills & Utilities');
    expect(parseBudgetArgs('/budget Top 10 5000 9', 2026)).toEqual({ category: 'Top 10', amount: 5000, month: 9, year: 2026 });
  });
  it('rejects malformed input', () => {
    expect(parseBudgetArgs('/budget Food')).toBeNull();
    expect(parseBudgetArgs('/budget Food abc 9')).toBeNull();
  });
});

describe('matchCategory', () => {
  const names = ['Food & Dining', 'Transportation', 'Bills & Utilities', 'Rent / Housing', 'Entertainment', 'Shopping'];
  it('matches case-insensitively and by substring', () => {
    expect(matchCategory(names, 'food')).toBe('Food & Dining');
    expect(matchCategory(names, 'RENT')).toBe('Rent / Housing');
    expect(matchCategory(names, 'bills & utilities')).toBe('Bills & Utilities');
  });
  it('returns null when nothing matches so a category gets created', () => {
    expect(matchCategory(names, 'Pets')).toBeNull();
  });
  it('prefers exact, then a unique prefix, else throws on ambiguity', () => {
    expect(matchCategory(['Food', 'Food & Dining'], 'food')).toBe('Food');
    expect(matchCategory(['Eating Out', 'Out of Pocket'], 'out')).toBe('Out of Pocket');
    expect(() => matchCategory(['Pet Food', 'Fast Food'], 'food')).toThrow('several categories');
  });
});
