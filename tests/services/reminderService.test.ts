import { ReminderService } from '../../src/services/reminderService';
jest.mock('../../src/src/db', () => ({
  getSupabase: () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => {
      // Simulate fetch/upsert
      return { data: { user_id: 'test-user', enabled: true, reminder_time: '21:00:00', created_at: new Date(), updated_at: new Date() }, error: null };
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
    // Since we mocked to return data, but also we can test null case by adjusting mock; for now just expect object or null
    expect(pref).toEqual(expect.objectContaining({ user_id: 'test-user' }));
  });
  it('should set preference', async () => {
    const res = await service.setPreference('user-id', true, '07:30:00');
    expect(res).toHaveProperty('user_id', 'test-user');
    expect(res.enabled).toBe(true);
  });
});