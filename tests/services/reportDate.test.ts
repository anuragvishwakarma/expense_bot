const eqCalls: [string, unknown][] = [];
jest.mock('../../src/db', () => ({
  getSupabase: () => {
    const b: any = { select: () => b, eq: (c: string, v: unknown) => { eqCalls.push([c, v]); return b; }, then: (res: any) => res({ data: [], error: null }) };
    return { from: () => b };
  },
}));
import { ReportService } from '../../src/services/reportService';

describe("ReportService.getDailySummary 'today'", () => {
  afterEach(() => jest.useRealTimers());
  it('uses the IST date: after 18:30 UTC it is already the next day', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-04T20:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout'] });
    eqCalls.length = 0;
    const s = await new ReportService().getDailySummary('u1');
    expect(s.date).toBe('2026-10-05');
    expect(eqCalls).toContainEqual(['date', '2026-10-05']);
  });
});
