import { chunk, inr, progressBar, shiftMonth, parseAmountInput, parseTimeInput, parseDateInput, istDate } from '../../src/bot/ui';

describe('bot ui helpers', () => {
  it('chunks arrays', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('formats rupees', () => {
    expect(inr(125000)).toBe('₹1,25,000');
  });
  it('draws a clamped progress bar', () => {
    expect(progressBar(50)).toBe('▓▓▓▓▓░░░░░');
    expect(progressBar(250)).toBe('▓▓▓▓▓▓▓▓▓▓');
    expect(progressBar(-5)).toBe('░░░░░░░░░░');
  });
  it('shifts months across year boundaries', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
  it('parses amounts', () => {
    expect(parseAmountInput('1,500')).toBe(1500);
    expect(parseAmountInput('₹2k')).toBe(2000);
    expect(parseAmountInput('1.5k')).toBe(1500);
    expect(parseAmountInput('0')).toBeNull();
    expect(parseAmountInput('lunch')).toBeNull();
    expect(parseAmountInput('-5')).toBeNull();
  });
  it('parses times', () => {
    expect(parseTimeInput('9')).toBe('09:00');
    expect(parseTimeInput('21:05')).toBe('21:05');
    expect(parseTimeInput('24:00')).toBeNull();
    expect(parseTimeInput('9:75')).toBeNull();
  });
  it('validates real calendar dates', () => {
    expect(parseDateInput('2026-10-31')).toBe('2026-10-31');
    expect(parseDateInput('2026-02-30')).toBeNull();
    expect(parseDateInput('31-10-2026')).toBeNull();
  });
  it('computes IST dates', () => {
    // 20:00 UTC on 4 Oct is already 5 Oct in IST
    expect(istDate(0, new Date('2026-10-04T20:00:00Z'))).toBe('2026-10-05');
    expect(istDate(1, new Date('2026-10-04T10:00:00Z'))).toBe('2026-10-05');
  });
});
