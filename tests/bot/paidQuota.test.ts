import { takePaidCall, MAX_PAID_PER_DAY } from '../../src/bot/paidQuota';

const at = (iso: string) => new Date(iso);

describe('takePaidCall', () => {
  it('allows 50 paid calls a day per user, then refuses', () => {
    const t = at('2026-10-14T06:00:00Z');
    for (let i = 0; i < MAX_PAID_PER_DAY; i++) expect(takePaidCall('quota-a', t)).toBe(true);
    expect(takePaidCall('quota-a', t)).toBe(false);
    expect(takePaidCall('quota-a', t)).toBe(false);
  });

  it('counts each user separately', () => {
    const t = at('2026-10-14T06:00:00Z');
    for (let i = 0; i < MAX_PAID_PER_DAY; i++) takePaidCall('quota-b', t);
    expect(takePaidCall('quota-b', t)).toBe(false);
    expect(takePaidCall('quota-c', t)).toBe(true);
  });

  it('resets at midnight IST, not midnight UTC', () => {
    for (let i = 0; i < MAX_PAID_PER_DAY; i++) takePaidCall('quota-d', at('2026-10-14T17:00:00Z')); // 22:30 IST on the 14th
    expect(takePaidCall('quota-d', at('2026-10-14T18:00:00Z'))).toBe(false); // 23:30 IST, same IST day
    expect(takePaidCall('quota-d', at('2026-10-14T18:31:00Z'))).toBe(true); // 00:01 IST on the 15th
  });
});
