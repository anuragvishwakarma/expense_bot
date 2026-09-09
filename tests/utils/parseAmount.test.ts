import { parseAmount } from '../../src/utils/parseAmount';

describe('parseAmount', () => {
  it('should parse simple amount', () => {
    const result = parseAmount('500 lunch');
    expect(result).toEqual({ amount: 500, remainder: 'lunch' });
  });

  it('should parse amount with decimals', () => {
    const result = parseAmount('250.50 coffee');
    expect(result).toEqual({ amount: 250.5, remainder: 'coffee' });
  });

  it('should parse amount with commas', () => {
    const result = parseAmount('1,500 groceries');
    expect(result).toEqual({ amount: 1500, remainder: 'groceries' });
  });

  it('should return null for invalid format', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('no amount here')).toBeNull();
  });

  it('should handle extra whitespace', () => {
    const result = parseAmount('  1000   salary  ');
    expect(result).toEqual({ amount: 1000, remainder: 'salary' });
  });
});