import { CurrencyService } from '../../src/services/currencyService';

global.fetch = jest.fn();

describe('CurrencyService', () => {
  let currencyService: CurrencyService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should convert between same currencies', async () => {
    currencyService = new CurrencyService('test-key');
    const result = await currencyService.convert(1000, 'INR', 'inr');
    expect(result).toBe(1000);
  });

  it('should return amount if no API key and same currency', async () => {
    currencyService = new CurrencyService();
    const result = await currencyService.convert(1000, 'INR', 'INR');
    expect(result).toBe(1000);
  });

  it('should return amount if no API key and different currency', async () => {
    currencyService = new CurrencyService();
    const result = await currencyService.convert(1000, 'INR', 'USD');
    expect(result).toBe(1000);
  });

  it('should convert currency with API key', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        result: 1.2,
      }),
    });

    currencyService = new CurrencyService('test-key');
    const result = await currencyService.convert(1000, 'INR', 'USD');

    expect(result).toBe(1200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('exchangerate.host/convert')
    );
  });

  it('should cache conversion rates', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        result: 1.2,
      }),
    });

    currencyService = new CurrencyService('test-key');

    // First call
    const result1 = await currencyService.convert(1000, 'INR', 'USD');
    expect(result1).toBe(1200);

    // Second call (should use cache)
    const result2 = await currencyService.convert(500, 'INR', 'USD');
    expect(result2).toBe(600);

    // Fetch should only be called once (cached)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    currencyService = new CurrencyService('test-key');
    const result = await currencyService.convert(1000, 'INR', 'USD');

    // Should return original amount on error
    expect(result).toBe(1000);
  });

  it('should handle API response errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        error: { info: 'Invalid currency' },
      }),
    });

    currencyService = new CurrencyService('test-key');
    const result = await currencyService.convert(1000, 'INVALID', 'USD');

    expect(result).toBe(1000);
  });
});
