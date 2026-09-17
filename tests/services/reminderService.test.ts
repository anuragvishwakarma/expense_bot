import { ReminderService } from '../../src/services/reminderService';

jest.mock('../../src/db', () => ({
  getSupabase: () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ 
      data: { user_id: 'test-user', enabled: true, reminder_time: '21:00:00', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, 
      error: null 
    }),
    maybeSingle: jest.fn().mockResolvedValue({ 
      data: { user_id: 'test-user', enabled: true, reminder_time: '21:00:00', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, 
      error: null 
    })
  })
}));

describe('ReminderService', () => {
  let service: ReminderService;
  beforeEach(() => {
    service = new ReminderService();
  });
  it('should get preference (null if none)', async () => {
    const pref = await service.getPreference('user-id');
    expect(pref).toEqual(expect.objectContaining({ user_id: 'test-user' }));
  });
  it('should set preference', async () => {
    const res = await service.setPreference('user-id', true, '07:30:00');
    expect(res).toHaveProperty('user_id', 'test-user');
    expect((res as any).enabled).toBe(true);
  });
});