import { readTransferAmount, isTransferExpired, TRANSFER_TTL_MS } from '../../src/bot/transfer';

describe('readTransferAmount', () => {
  it.each([['10000', 10000], ['1,500', 1500], ['₹2k', 2000], ['1.5k', 1500], [' 250 ', 250]])('reads %s', (text, amount) => {
    expect(readTransferAmount(text)).toEqual({ amount });
  });

  it.each(['500 lunch', '+500 salary', 'lunch 200', '1e9', 'Infinity', '0', '-5', '', 'abc'])('refuses %j instead of guessing', text => {
    expect(readTransferAmount(text)).toHaveProperty('error');
  });

  it('refuses an amount above the database limit with a readable message', () => {
    const r = readTransferAmount('999999999');
    expect(r).toHaveProperty('error');
    expect((r as { error: string }).error).toContain('too large');
  });
});

describe('isTransferExpired', () => {
  it('expires after the TTL and not before', () => {
    expect(isTransferExpired({ at: 1000 }, 1000 + TRANSFER_TTL_MS)).toBe(false);
    expect(isTransferExpired({ at: 1000 }, 1000 + TRANSFER_TTL_MS + 1)).toBe(true);
  });
});
