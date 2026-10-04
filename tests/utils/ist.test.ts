import { todayIST, startOfISTDay } from '../../src/utils/ist';
import { extractDate } from '../../src/utils/parseDate';

describe('IST dates', () => {
  it('is already tomorrow in IST after 18:30 UTC', () => {
    expect(todayIST(0, new Date('2026-10-04T18:29:00Z'))).toBe('2026-10-04');
    expect(todayIST(0, new Date('2026-10-04T18:31:00Z'))).toBe('2026-10-05');
    expect(todayIST(0, new Date('2026-10-04T23:59:00Z'))).toBe('2026-10-05');
  });
  it('offsets by whole days, including across a month end', () => {
    expect(todayIST(-6, new Date('2026-10-04T10:00:00Z'))).toBe('2026-09-28');
    expect(todayIST(1, new Date('2026-10-31T20:00:00Z'))).toBe('2026-11-02');
  });
  it('starts an IST day at 00:00 IST (18:30 UTC the evening before)', () => {
    expect(startOfISTDay('2026-10-10').toISOString()).toBe('2026-10-09T18:30:00.000Z');
  });
});

describe('extractDate ISO dates', () => {
  const now = new Date('2026-10-04T10:00:00Z');
  it('reads YYYY-MM-DD and drops it from the text', () => {
    expect(extractDate('2026-10-02', now)).toEqual({ date: '2026-10-02', text: '' });
    expect(extractDate('lunch 2026-09-30', now)).toEqual({ date: '2026-09-30', text: 'lunch' });
  });
  it('rejects future and impossible dates', () => {
    expect(extractDate('2026-10-05', now).date).toBeNull();
    expect(extractDate('2026-02-30', now).date).toBeNull();
  });
});
