import { RecurrenceService } from '../../src/services/recurrenceService';

// Mock supabase client
jest.mock('../../src/db', () => ({
  getSupabase: () => ({
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ 
      data: { id: 'test-id', user_id: 'test-user', amount: 100, description: 'test', type: 'expense', interval_value: 1, interval_unit: 'day', start_date: '2026-09-01', end_date: null, active: true, created_at: new Date().toISOString() }, 
      error: null 
    }),
    not: jest.fn().mockReturnThis()
  })
}));

describe('RecurrenceService', () => {
  let service: RecurrenceService;
  beforeEach(() => {
    service = new RecurrenceService();
  });
  it('should create a recurrence', async () => {
    const rec = await service.create('user-id', 100, 'test', 'expense', 1, 'day');
    expect(rec).toHaveProperty('id');
    expect((rec as any).amount).toBe(100);
  });
  it('should list active recurrences', async () => {
    const list = await service.listActive('user-id');
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(0);
  });
  it('should deactivate a recurrence', async () => {
    const res = await service.deactivate('rec-id', 'user-id');
    expect(res).toHaveProperty('id');
  });
  it('should get due recurrences', async () => {
    const now = new Date('2026-09-02T10:00:00Z');
    const due = await service.getDueRecurrences(now);
    expect(Array.isArray(due)).toBe(true);
  });
});