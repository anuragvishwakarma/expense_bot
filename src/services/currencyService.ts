import { getSupabase } from '../db';

const CONVERSION_UNAVAILABLE = 'Currency conversion is unavailable right now. Please enter the amount in ₹.';

export class CurrencyService {
  private apiKey: string | null;
  private baseCurrency: string = 'INR';
  private cache: Map<string, { rate: number; timestamp: number }> = new Map();
  private cacheDuration: number = 60 * 60 * 1000; // 1 hour

  constructor(apiKey: string | null = null) {
    this.apiKey = apiKey;
  }

  /**
   * Convert an amount from one currency to another.
   * If apiKey is not provided, returns the same amount (assuming base currency).
   * Uses a free API (exchangerate.host) with caching.
   */
  async convert(amount: number, from: string, to: string): Promise<number> {
    if (!this.apiKey) {
      // If no API key, assume same currency (or base currency conversion not available)
      // For simplicity, we just return the amount if converting to/from same currency.
      // In a real app, you might want to throw or use a fixed rate.
      if (from.toUpperCase() === to.toUpperCase()) {
        return amount;
      }
      // Never record foreign money as if it were rupees.
      throw new Error(CONVERSION_UNAVAILABLE);
    }

    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    // If same currency, return amount
    if (fromUpper === toUpper) {
      return amount;
    }

    const cacheKey = `${fromUpper}-${toUpper}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheDuration) {
      return amount * cached.rate;
    }

    try {
      const response = await fetch(`https://api.exchangerate.host/convert?from=${fromUpper}&to=${toUpper}&amount=1&access_key=${this.apiKey}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch conversion rate: ${response.status}`);
      }
      interface ExchangeRateResponse {
        success: boolean;
        error?: { info: string };
        result?: number;
      }
      const data = await response.json() as ExchangeRateResponse;
      if (!data.success) {
        throw new Error(`API error: ${data.error?.info || 'Unknown error'}`);
      }
      const rate = data.result ?? 1; // This is the amount of 'to' currency for 1 unit of 'from'
      this.cache.set(cacheKey, { rate, timestamp: now });
      return amount * rate;
    } catch (error) {
      console.error('Currency conversion error:', error);
      throw new Error(CONVERSION_UNAVAILABLE);
    }
  }
}