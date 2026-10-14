import { userMessage } from '../../src/utils/userMessage';
import { isValidYearMonth } from '../../src/utils/limits';
import { PostgrestError } from '@supabase/postgrest-js';

describe('userMessage', () => {
  it('passes through our own readable errors', () => {
    expect(userMessage(new Error('Insufficient balance. Available: 10.00'))).toBe('Insufficient balance. Available: 10.00');
  });

  it('hides a real PostgrestError, whose message is database text', () => {
    const e = new PostgrestError({ message: 'invalid input syntax for type date: "2026-99-01"', details: 'x', hint: '', code: '22007' });
    expect(e).toBeInstanceOf(Error); // this is why a bare instanceof Error check leaks it
    expect(userMessage(e)).not.toContain('invalid input');
    expect(userMessage(e)).toBe('Something went wrong. Please try again.');
  });

  it('hides an error-shaped object from the database driver', () => {
    const e = Object.assign(new Error('duplicate key value violates unique constraint "users_pkey"'), { code: '23505', details: 'Key (id)=(1)' });
    expect(userMessage(e)).toBe('Something went wrong. Please try again.');
  });

  it('gives a generic line for non-errors and empty messages', () => {
    expect(userMessage('boom')).toBe('Something went wrong. Please try again.');
    expect(userMessage(undefined)).toBe('Something went wrong. Please try again.');
    expect(userMessage(new Error(''))).toBe('Something went wrong. Please try again.');
  });
});

describe('isValidYearMonth', () => {
  it.each([[2026, 10], [2020, 1], [2100, 12]])('accepts %i-%i', (y, m) => expect(isValidYearMonth(y, m)).toBe(true));
  it.each([[2026, 0], [2026, 13], [2026, 1.5], [2019, 5], [2101, 5], [NaN, 5], [2026, NaN], [99999999, 1]])('refuses %p-%p', (y, m) => expect(isValidYearMonth(y, m)).toBe(false));
});
