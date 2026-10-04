const mockCategories = [
  { id: 'cat-food', name: 'Food' },
  { id: 'cat-transport', name: 'Transport' }
];

function buildCategoriesQuery() {
  // Real chain shapes (see src/services/transactionService.ts):
  //   name match:            select().eq().eq().ilike().limit()
  //   Uncategorized lookup:  select().eq().eq().ilike().limit() (separate call)
  //   Uncategorized create:  insert().select().single()
  // `.limit()` is the terminal call for lookups; it filters by whatever name
  // `.ilike()` was last called with on this same builder instance.
  const builder: any = {
    // `await supabase.from('categories').select('name').eq().eq()` (the category-guess lookup)
    then: (resolve: (v: any) => void) => resolve({ data: mockCategories, error: null }),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn(function (this: any, _col: string, value: string) {
      this.__ilikeValue = value;
      return this;
    }),
    limit: jest.fn(function (this: any) {
      const matched = mockCategories.filter(
        c => c.name.toLowerCase() === this.__ilikeValue.toLowerCase()
      );
      return Promise.resolve({ data: matched, error: null });
    }),
    insert: jest.fn(function (this: any, row: any) {
      this.__inserted = { id: 'cat-uncategorized', name: row.name };
      return this;
    }),
    single: jest.fn(function (this: any) {
      return Promise.resolve({ data: this.__inserted, error: null });
    })
  };

  return builder;
}

function buildAccountsQuery() {
  // Real chain shapes (see src/services/accountService.ts):
  //   getDefaultAccount: select().eq().order().limit(1).single()
  //   getAccount:        select().eq().eq().single()
  //   updateAccount:     update().eq().eq().select().single()
  // In every case `.single()` is the terminal call that actually resolves;
  // everything before it just returns the same builder (matches supabase-js).
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: 'acc-1', user_id: 'user-1', current_balance: 0, currency_code: 'INR' },
      error: null
    })
  };
}

function buildTransactionsQuery(categoryIdSeen: { value: string | null }) {
  // Real supabase-js only sets `Prefer: return=representation` when `.select()`
  // is called; without it, `.insert(...).single()` resolves with `data: null`.
  // This fake mirrors that so a missing `.select()` fails loudly here too.
  const builder: any = {
    insert: jest.fn(function (this: any, row: any) {
      categoryIdSeen.value = row.category_id;
      (globalThis as any).__lastTxnRow = row;
      return this;
    }),
    select: jest.fn(function (this: any) {
      this.__selected = true;
      return this;
    }),
    single: jest.fn(function (this: any) {
      if (!this.__selected) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({
        data: {
          id: 'txn-1',
          user_id: 'user-1',
          amount: 500,
          description: 'test',
          type: 'expense',
          category_id: categoryIdSeen.value
        },
        error: null
      });
    })
  };
  return builder;
}

describe('TransactionService', () => {
  let transactionService: any;
  let categoryIdSeen: { value: string | null };

  beforeEach(() => {
    categoryIdSeen = { value: null };
    jest.resetModules();
    jest.doMock('../../src/db', () => ({
      getSupabase: () => ({
        from: (table: string) => {
          if (table === 'categories') return buildCategoriesQuery();
          if (table === 'accounts') return buildAccountsQuery();
          if (table === 'transactions') return buildTransactionsQuery(categoryIdSeen);
          throw new Error(`unexpected table ${table}`);
        }
      })
    }));
    const { TransactionService: FreshTransactionService } = require('../../src/services/transactionService');
    transactionService = new FreshTransactionService();
  });

  it('should be defined', () => {
    expect(transactionService).toBeDefined();
  });

  it('uses the matching category when categoryName is given', async () => {
    await transactionService.addTransaction('user-1', '500 lunch', 'expense', undefined, 'Transport');
    expect(categoryIdSeen.value).toBe('cat-transport');
  });

  it('falls back to Uncategorized when categoryName matches nothing', async () => {
    await transactionService.addTransaction('user-1', '500 lunch', 'expense', undefined, 'Nonexistent');
    expect(categoryIdSeen.value).toBe('cat-uncategorized');
  });

  it('falls back to Uncategorized when categoryName is omitted', async () => {
    await transactionService.addTransaction('user-1', '500 lunch', 'expense');
    expect(categoryIdSeen.value).toBe('cat-uncategorized');
  });

  it('returns the inserted row instead of null (insert must call .select())', async () => {
    const transaction = await transactionService.addTransaction('user-1', '500 lunch', 'expense');
    expect(transaction).not.toBeNull();
    expect(transaction.amount).toBe(500);
  });

  it('returns the actually-resolved category name, not just its id', async () => {
    const transaction = await transactionService.addTransaction('user-1', '500 lunch', 'expense', undefined, 'Transport');
    expect(transaction.category_name).toBe('Transport');
  });

  it('returns the fallback category name when categoryName matches nothing', async () => {
    const transaction = await transactionService.addTransaction('user-1', '500 lunch', 'expense', undefined, 'Nonexistent');
    expect(transaction.category_name).toBe('Uncategorized');
  });

  it('refuses a zero amount', async () => {
    await expect(transactionService.addTransaction('user-1', '0 nothing', 'expense')).rejects.toThrow('more than 0');
  });

  it('refuses an amount the database cannot hold, with a readable message', async () => {
    await expect(transactionService.addTransaction('user-1', '99999999999 big', 'expense')).rejects.toThrow('too large');
  });

  it('caps very long descriptions at 200 characters before saving', async () => {
    await transactionService.addTransaction('user-1', `500 ${'x'.repeat(5000)}`, 'expense');
    expect((globalThis as any).__lastTxnRow.description).toHaveLength(200);
  });

  it('saves "lunch at KFC" with amount 50 and the full description (KFC is not a currency)', async () => {
    await transactionService.addTransaction('user-1', '50 lunch at KFC', 'expense');
    const row = (globalThis as any).__lastTxnRow;
    expect(row.amount).toBe(50);
    expect(row.description).toBe('lunch at KFC');
    expect(row.currency_code).toBe('INR');
  });

  it('saves "2k rent" as 2000', async () => {
    await transactionService.addTransaction('user-1', '2k rent', 'expense');
    expect((globalThis as any).__lastTxnRow.amount).toBe(2000);
  });

  it('infers a category from the description when none is given (typed /add)', async () => {
    await transactionService.addTransaction('user-1', '600 food party', 'expense');
    expect(categoryIdSeen.value).toBe('cat-food');
  });

  it('does not override a category the caller chose', async () => {
    await transactionService.addTransaction('user-1', '600 food party', 'expense', undefined, 'Transport');
    expect(categoryIdSeen.value).toBe('cat-transport');
  });

  it('saves an explicit IST date, never relying on the UTC database default', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-04T20:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout'] });
    try {
      await transactionService.addTransaction('user-1', '500 lunch', 'expense');
      expect((globalThis as any).__lastTxnRow.date).toBe('2026-10-05'); // 01:30 IST on the 5th
      await transactionService.addTransaction('user-1', '500 lunch yesterday', 'expense');
      expect((globalThis as any).__lastTxnRow.date).toBe('2026-10-04');
    } finally {
      jest.useRealTimers();
    }
  });
});
