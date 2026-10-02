const mockGetAccount = jest.fn();
const mockUpdateAccount = jest.fn().mockResolvedValue({});
jest.mock('../../src/services/accountService', () => ({
  AccountService: jest.fn().mockImplementation(() => ({
    getAccount: mockGetAccount,
    updateAccount: mockUpdateAccount
  }))
}));
jest.mock('../../src/services/currencyService', () => ({ CurrencyService: jest.fn() }));

let deleteResult: any;
jest.mock('../../src/db', () => ({
  getSupabase: () => {
    const b: any = {
      delete: () => b,
      eq: () => b,
      select: () => b,
      single: () => Promise.resolve(deleteResult)
    };
    return { from: () => b };
  }
}));

import { TransactionService } from '../../src/services/transactionService';

describe('deleteTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccount.mockResolvedValue({ id: 'acc', current_balance: 1000 });
  });

  it('gives money back to the account when an expense is deleted', async () => {
    deleteResult = { data: { id: 't', account_id: 'acc', type: 'expense', amount_base: 300 }, error: null };
    await new TransactionService().deleteTransaction('u', 't');
    expect(mockUpdateAccount).toHaveBeenCalledWith('acc', 'u', { current_balance: 1300 });
  });

  it('takes money back when an income is deleted', async () => {
    deleteResult = { data: { id: 't', account_id: 'acc', type: 'income', amount_base: 300 }, error: null };
    await new TransactionService().deleteTransaction('u', 't');
    expect(mockUpdateAccount).toHaveBeenCalledWith('acc', 'u', { current_balance: 700 });
  });

  it('throws and leaves the balance alone when the entry is missing', async () => {
    deleteResult = { data: null, error: { code: 'PGRST116' } };
    await expect(new TransactionService().deleteTransaction('u', 't')).rejects.toThrow('not found');
    expect(mockUpdateAccount).not.toHaveBeenCalled();
  });
});
