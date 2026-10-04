jest.mock('node-cron', () => ({
  schedule: (_expr: string, fn: () => Promise<void>) => {
    (global as any).__cronFn = fn;
    return { start: jest.fn(), stop: jest.fn() };
  }
}));

const mockGetDueRecurrences = jest.fn();
const mockClaimRun = jest.fn().mockResolvedValue(true);
jest.mock('../src/services/recurrenceService', () => ({
  RecurrenceService: jest.fn().mockImplementation(() => ({
    getDueRecurrences: mockGetDueRecurrences,
    claimRun: mockClaimRun
  }))
}));

const mockAddTransaction = jest.fn();
jest.mock('../src/services/transactionService', () => ({
  TransactionService: jest.fn().mockImplementation(() => ({
    addTransaction: mockAddTransaction
  }))
}));

jest.mock('../src/services/reminderService', () => ({
  ReminderService: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../src/services/userService', () => ({
  UserService: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../src/db', () => ({
  initSupabase: jest.fn(),
  getSupabase: () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: [], error: null })
  })
}));

import { startWorker } from '../src/worker';

describe('worker recurrence processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates one transaction per due recurrence, owned by that recurrence\'s own user, with a single getDueRecurrences call (no per-system-user fan-out)', async () => {
    mockGetDueRecurrences.mockResolvedValue([
      { id: 'r1', user_id: 'user-a', amount: 100, description: 'rent', type: 'expense' },
      { id: 'r2', user_id: 'user-b', amount: 50, description: 'gym', type: 'expense' }
    ]);
    mockAddTransaction.mockResolvedValue({});

    startWorker({} as any);
    await (global as any).__cronFn();

    expect(mockGetDueRecurrences).toHaveBeenCalledTimes(1);
    expect(mockClaimRun).toHaveBeenCalledTimes(2);
    expect(mockAddTransaction).toHaveBeenCalledTimes(2);
    expect(mockAddTransaction).toHaveBeenCalledWith('user-a', '₹100 rent', 'expense');
    expect(mockAddTransaction).toHaveBeenCalledWith('user-b', '₹50 gym', 'expense');
  });

  it('skips an occurrence another instance already claimed (rolling-deploy overlap)', async () => {
    mockGetDueRecurrences.mockResolvedValue([{ id: 'r1', user_id: 'user-a', amount: 100, description: 'rent', type: 'expense', last_run_at: null }]);
    mockClaimRun.mockResolvedValueOnce(false);

    startWorker({} as any);
    await (global as any).__cronFn();

    expect(mockAddTransaction).not.toHaveBeenCalled();
  });

  it('keeps processing the rest when one recurrence fails, and still sends ₹-prefixed text so "EMI" is not read as a currency', async () => {
    mockGetDueRecurrences.mockResolvedValue([
      { id: 'r1', user_id: 'user-a', amount: 100, description: 'EMI', type: 'expense' },
      { id: 'r2', user_id: 'user-b', amount: 50, description: 'gym', type: 'expense' }
    ]);
    mockAddTransaction.mockRejectedValueOnce(new Error('No account found')).mockResolvedValueOnce({});

    startWorker({ telegram: { sendMessage: jest.fn() } } as any);
    await (global as any).__cronFn();

    expect(mockAddTransaction).toHaveBeenCalledTimes(2);
    expect(mockAddTransaction).toHaveBeenNthCalledWith(1, 'user-a', '₹100 EMI', 'expense');
    expect(mockClaimRun).toHaveBeenCalledTimes(2);
  });
});
