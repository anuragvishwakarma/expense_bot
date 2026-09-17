import { parseAmount } from '../../src/utils/parseAmount';

describe('parseAmount', () => {
  it('should parse simple amount', () => {
    const result = parseAmount('500 lunch');
    expect(result).toEqual({ amount: 500, currency: 'INR', remainder: 'lunch' });
  });

  it('should parse amount with decimals', () => {
    const result = parseAmount('250.50 coffee');
    expect(result).toEqual({ amount: 250.5, currency: 'INR', remainder: 'coffee' });
  });

  it('should parse amount with commas', () => {
    const result = parseAmount('1,500 groceries');
    expect(result).toEqual({ amount: 1500, currency: 'INR', remainder: 'groceries' });
  });

  it('should return null for invalid format', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('no amount here')).toBeNull();
  });

  it('should handle extra whitespace', () => {
    const result = parseAmount('  1000   salary  ');
    expect(result).toEqual({ amount: 1000, currency: 'INR', remainder: 'salary' });
  });

  it('should parse currency symbol', () => {
    const result = parseAmount('$50 lunch');
    expect(result).toEqual({ amount: 50, currency: 'USD', remainder: 'lunch' });
  });

  it('should parse currency code', () => {
    const result = parseAmount('100 EUR dinner');
    expect(result).toEqual({ amount: 100, currency: 'EUR', remainder: 'dinner' });
  });
});