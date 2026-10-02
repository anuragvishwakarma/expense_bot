import { extractDate } from '../../src/utils/parseDate';

const now = new Date('2026-10-03T06:00:00Z'); // 3 Oct 2026 IST

describe('extractDate', () => {
  it.each([
    ['lunch yesterday', '2026-10-02', 'lunch'],
    ['lunch today', '2026-10-03', 'lunch'],
    ['dinner 2 days ago', '2026-10-01', 'dinner'],
    ['taxi day before yesterday', '2026-10-01', 'taxi'],
    ['dinner at Achari Spoon on 30 oct', '2026-09-30'.replace('09', '10').replace('2026', '2025'), 'dinner at Achari Spoon'],
    ['movie Oct 1st', '2026-10-01', 'movie'],
    ['rent 5 sept 2025', '2025-09-05', 'rent'],
    ['coffee 3 days back', '2026-09-30', 'coffee'],
  ])('%s', (input, date, text) => {
    expect(extractDate(input, now)).toEqual({ date, text });
  });

  it('returns null date when no phrase', () => {
    expect(extractDate('lunch at mayo cafe', now)).toEqual({ date: null, text: 'lunch at mayo cafe' });
  });

  it('rejects impossible and future dates', () => {
    expect(extractDate('x 31 feb', now).date).toBeNull();
    expect(extractDate('x 5 nov 2027', now).date).toBeNull();
  });
});
