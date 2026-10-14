jest.mock('node-cron', () => ({
  schedule: (_e: string, fn: () => Promise<void>) => { (global as any).__cronFn2 = fn; return { start: jest.fn(), stop: jest.fn() }; },
}));
jest.mock('../src/services/recurrenceService', () => ({
  RecurrenceService: jest.fn().mockImplementation(() => ({ getDueRecurrences: async () => [], claimRun: async () => true })),
}));
jest.mock('../src/services/transactionService', () => ({ TransactionService: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../src/services/reminderService', () => ({ ReminderService: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../src/services/userService', () => ({ UserService: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../src/utils/alert', () => ({ alertOwner: jest.fn() }));

const NOW = new Date('2026-10-14T09:00:00Z'); // 14:30 IST
const reminders = [
  { user_id: 'a', reminder_time: '14:30:00' },
  { user_id: 'b', reminder_time: '14:30:00' },
];
jest.mock('../src/db', () => ({
  initSupabase: jest.fn(),
  getSupabase: () => ({
    from: (table: string) => {
      let id: unknown;
      const b: any = {};
      b.select = () => b;
      b.update = () => b;
      b.eq = (c: string, v: unknown) => {
        if (c === 'user_id' || c === 'id') id = v;
        if (table === 'user_reminders' && c === 'enabled') return Promise.resolve({ data: reminders, error: null });
        if (table === 'transactions' && c === 'date') return Promise.resolve({ count: 0 });
        return b;
      };
      b.single = () => Promise.resolve(id === 'a' ? { data: null, error: { message: 'db down for a' } } : { data: { telegram_id: 222 }, error: null });
      return b;
    },
  }),
}));

import { startWorker } from '../src/worker';

describe('reminder loop', () => {
  beforeEach(() => { jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'setTimeout'] }); });
  afterEach(() => jest.useRealTimers());

  it('still reminds user b when looking up user a fails', async () => {
    const sendMessage = jest.fn().mockResolvedValue({});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    startWorker({ telegram: { sendMessage } } as any);
    await (global as any).__cronFn2();
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][0]).toBe(222);
    err.mockRestore();
  });
});
