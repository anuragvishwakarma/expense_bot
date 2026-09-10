import { getSupabase } from '../db';

export class CurrencyService {
  // Simple in-memory cache for rates (optional, could use Redis or DB table)
  private static cache: Map<string, { rate: number; expiresAt: number }> = new Map();
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  async getRate(base: string, target: string): Promise<number> {
    if (base === target) return 1;
    const key = `${base}:${target}`;
    const cached = CurrencyService.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.rate;
    }
    // Try to fetch from rates table
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('currency_rates')
      .select('rate')
      .eq('base_currency', base)
      .eq('target_currency', target)
      .single();
    if (!error && data) {
      const rate = Number(data.rate);
      CurrencyService.cache.set(key, { rate, expiresAt: Date.now() + CurrencyService.CACHE_TTL_MS });
      return rate;
    }
    // Fallback: use a free API (exchangerate.host) - optional
    try {
      const resp = await fetch(`https://api.exchangerate.host/latest?base=${base}&symbols=${target}`);
      const json = await resp.json();
      if (json.success && json.rates && json.rates[target]) {
        const rate = Number(json.rates[target]);
        // Store in DB for future use
        await supabase
          .from('currency_rates')
          .upsert({ base_currency: base, target_currency: target, rate }, { onConflict: ['base_currency', 'target_currency'] });
        CurrencyService.cache.set(key, { rate, expiresAt: Date.now() + CurrencyService.CACHE_TTL_MS });
        return rate;
      }
    } catch (e) {
      console.warn('Failed to fetch exchange rate from API', e);
    }
    // If all fails, assume 1:1 (should not happen for major currencies)
    return 1;
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    const rate = await this.getRate(from, to);
    return amount * rate;
  }
}