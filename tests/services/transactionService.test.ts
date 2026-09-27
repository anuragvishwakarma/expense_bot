const mockCategories = [
  { id: 'cat-food', name: 'Food' },
  { id: 'cat-transport', name: 'Transport' }
];

function buildCategoriesQuery() {
  // Real chain shapes (see src/services/transactionService.ts):
  //   with categoryName:    select().eq().eq().ilike().limit()
  //   fallback (no match):  select().eq().eq().order().limit()
  // `.limit()` is the terminal call that resolves; it inspects whether
  // `.ilike()` was called on this same builder instance to decide which
  // result set to return.
  const rows = [mockCategories[0]]; // order('name').limit(1) equivalent

  const builder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    ilike: jest.fn(function (this: any, _col: string, value: string) {
      this.__ilikeValue = value;
      return this;
    }),
    limit: jest.fn(function (this: any) {
      if (this.__ilikeValue) {
        const matched = mockCategories.filter(
          c => c.name.toLowerCase() === this.__ilikeValue.toLowerCase()
        );
        return Promise.resolve({ data: matched, error: null });
      }
      return Promise.resolve({ data: rows, error: null });
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
  return {
    insert: jest.fn(function (this: any, row: any) {
      categoryIdSeen.value = row.category_id;
      return this;
    }),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({
      data: {
        id: 'txn-1',
        user_id: 'user-1',
        amount: 500,
        description: 'test',
        type: 'expense',
        category_id: categoryIdSeen.value
      },
      error: null
    }))
  };
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

  it('falls back to the first category when categoryName matches nothing', async () => {
    await transactionService.addTransaction('user-1', '500 lunch', 'expense', undefined, 'Nonexistent');
    expect(categoryIdSeen.value).toBe('cat-food');
  });

  it('keeps existing first-alphabetical behavior when categoryName is omitted', async () => {
    await transactionService.addTransaction('user-1', '500 lunch', 'expense');
    expect(categoryIdSeen.value).toBe('cat-food');
  });
});
