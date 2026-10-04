import { checkAmount, checkName, MAX_AMOUNT } from '../../src/utils/limits';
import { assertCronNotTooFrequent } from '../../src/services/recurrenceService';

describe('checkAmount', () => {
  it('accepts normal amounts', () => {
    expect(checkAmount(500)).toBe(500);
    expect(checkAmount(MAX_AMOUNT)).toBe(MAX_AMOUNT);
    expect(checkAmount(0, 'starting balance', { allowZero: true })).toBe(0);
  });
  it('refuses zero, negative, non-finite and oversized amounts with a readable message', () => {
    expect(() => checkAmount(0)).toThrow('more than 0');
    expect(() => checkAmount(-5, 'target')).toThrow('target must be more than 0');
    expect(() => checkAmount(NaN)).toThrow('more than 0');
    expect(() => checkAmount(MAX_AMOUNT + 1, 'goal')).toThrow('too large');
    expect(() => checkAmount(1e12)).toThrow('too large');
  });
});

describe('checkName', () => {
  it('trims and returns', () => expect(checkName('  Wallet ', 'account')).toBe('Wallet'));
  it('refuses empty and over-long names', () => {
    expect(() => checkName('   ', 'account')).toThrow('Please give the account a name');
    expect(() => checkName('x'.repeat(41), 'goal')).toThrow('too long');
    expect(checkName('x'.repeat(40), 'goal')).toHaveLength(40);
    expect(() => checkName('x'.repeat(101), 'note', 100)).toThrow('100 characters');
  });
});

describe('assertCronNotTooFrequent', () => {
  it('allows hourly or slower schedules', () => {
    expect(() => assertCronNotTooFrequent('0 9 1 * *')).not.toThrow();
    expect(() => assertCronNotTooFrequent('0 * * * *')).not.toThrow();
    expect(() => assertCronNotTooFrequent('30 8 * * 1')).not.toThrow();
  });
  it('refuses schedules that fire more often than hourly', () => {
    expect(() => assertCronNotTooFrequent('* * * * *')).toThrow('at least an hour');
    expect(() => assertCronNotTooFrequent('*/5 * * * *')).toThrow('at least an hour');
    expect(() => assertCronNotTooFrequent('0,30 * * * *')).toThrow('at least an hour');
  });
  it('explains an invalid expression', () => {
    expect(() => assertCronNotTooFrequent('not a cron')).toThrow('not valid');
    expect(() => assertCronNotTooFrequent('*')).toThrow('not valid');
  });
});
