let dbResult: Promise<any> = Promise.resolve({ error: null });
jest.mock('../src/db', () => ({
  getSupabase: () => ({ from: () => ({ select: () => ({ limit: () => dbResult }) }) }),
}));
import { healthStatus, markWorkerTick } from '../src/health';

describe('healthStatus', () => {
  beforeEach(() => { dbResult = Promise.resolve({ error: null }); markWorkerTick(); });

  it('is ok when the database answers and the worker ticked recently', async () => {
    expect(await healthStatus()).toEqual({ ok: true, db: true, worker: true });
  });
  it('fails when the database errors', async () => {
    dbResult = Promise.resolve({ error: { message: 'down' } });
    expect(await healthStatus()).toEqual({ ok: false, db: false, worker: true });
  });
  it('fails when the database call throws', async () => {
    dbResult = Promise.reject(new Error('network'));
    expect((await healthStatus()).db).toBe(false);
  });
  it('fails when the worker has stopped ticking (cron stuck)', async () => {
    const s = await healthStatus(Date.now() + 4 * 60_000);
    expect(s).toEqual({ ok: false, db: true, worker: false });
  });
});
