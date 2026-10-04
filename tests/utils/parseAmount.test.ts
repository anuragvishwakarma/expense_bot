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

  it('keeps descriptions with 3 capitals intact (KFC, ATM, EMI, SIP)', () => {
    expect(parseAmount('50 lunch at KFC')).toEqual({ amount: 50, currency: 'INR', remainder: 'lunch at KFC' });
    expect(parseAmount('500 EMI')).toEqual({ amount: 500, currency: 'INR', remainder: 'EMI' });
    expect(parseAmount('2000 SIP mutual fund')).toEqual({ amount: 2000, currency: 'INR', remainder: 'SIP mutual fund' });
  });

  it('understands k, lakh and crore suffixes', () => {
    expect(parseAmount('2k rent')).toEqual({ amount: 2000, currency: 'INR', remainder: 'rent' });
    expect(parseAmount('1.5k tip')).toEqual({ amount: 1500, currency: 'INR', remainder: 'tip' });
    expect(parseAmount('1.1k tip')?.amount).toBe(1100); // no float noise
    expect(parseAmount('1.5 lakh bonus')).toEqual({ amount: 150000, currency: 'INR', remainder: 'bonus' });
    expect(parseAmount('2cr plot')).toEqual({ amount: 20000000, currency: 'INR', remainder: 'plot' });
    expect(parseAmount('₹2k rent')).toEqual({ amount: 2000, currency: 'INR', remainder: 'rent' });
  });

  it('does not treat units or words as suffixes', () => {
    expect(parseAmount('50kg rice')).toEqual({ amount: 50, currency: 'INR', remainder: 'kg rice' });
    expect(parseAmount('5L milk')).toEqual({ amount: 5, currency: 'INR', remainder: 'L milk' });
    expect(parseAmount('50lunch')).toEqual({ amount: 50, currency: 'INR', remainder: 'lunch' });
  });

  it('recognises real currency codes in any case, and nothing else', () => {
    expect(parseAmount('5 usd lunch')).toEqual({ amount: 5, currency: 'USD', remainder: 'lunch' });
    expect(parseAmount('5USD lunch')).toEqual({ amount: 5, currency: 'USD', remainder: 'lunch' });
    expect(parseAmount('50$ lunch')).toEqual({ amount: 50, currency: 'USD', remainder: 'lunch' });
    expect(parseAmount('100 ABC dinner')).toEqual({ amount: 100, currency: 'INR', remainder: 'ABC dinner' });
  });

  it('rejects malformed numbers and passes zero through for the caller to refuse', () => {
    expect(parseAmount('1..5 lunch')).toBeNull();
    expect(parseAmount('1,,5 lunch')).toBeNull();
    expect(parseAmount('0 nothing')).toEqual({ amount: 0, currency: 'INR', remainder: 'nothing' });
  });
});
