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
import { isDue } from '../../src/services/recurrenceService';

describe('isDue', () => {
  const base: any = { id: 'r', interval_value: 1, interval_unit: 'day', start_date: '2026-09-01', end_date: null, cron_expression: null, last_run_at: null, created_at: '2026-09-01T00:00:00Z' };
  const t = (s: string) => new Date(s);
  it('fires once per day, not every minute', () => {
    expect(isDue(base, t('2026-09-02T10:00:00Z'))).toBe(true);
    const ran = { ...base, last_run_at: '2026-09-02T10:00:00Z' };
    expect(isDue(ran, t('2026-09-02T10:01:00Z'))).toBe(false);
    expect(isDue(ran, t('2026-09-03T10:00:00Z'))).toBe(true);
  });
  it('respects start and end dates', () => {
    expect(isDue({ ...base, start_date: '2026-10-01' }, t('2026-09-02T10:00:00Z'))).toBe(false);
    expect(isDue({ ...base, end_date: '2026-09-01' }, t('2026-09-02T10:00:00Z'))).toBe(false);
  });
  it('adds calendar months', () => {
    const r = { ...base, interval_unit: 'month', last_run_at: '2026-09-15T00:00:00Z' };
    expect(isDue(r, t('2026-10-14T23:59:00Z'))).toBe(false);
    expect(isDue(r, t('2026-10-15T00:00:00Z'))).toBe(true);
  });
  it('cron fires only when an occurrence follows the last run', () => {
    const r = { ...base, interval_value: null, interval_unit: null, cron_expression: '0 9 * * *' };
    expect(isDue(r, t('2026-09-02T09:00:30Z'))).toBe(true);
    expect(isDue({ ...r, last_run_at: '2026-09-02T09:00:30Z' }, t('2026-09-02T09:01:30Z'))).toBe(false);
    expect(isDue(r, t('2026-09-02T08:00:00Z'))).toBe(true); // 09-01 09:00 occurrence still after created_at
  });
});
