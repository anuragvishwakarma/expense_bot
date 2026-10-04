import * as crypto from 'crypto';

const calls: { table: string; op: string; payload?: any; eq?: [string, unknown] }[] = [];
let row: any = { auth_user_id: null };
jest.mock('../../src/db', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const b: any = {};
      b.select = () => b;
      b.update = (payload: any) => { calls.push({ table, op: 'update', payload }); b.__update = true; return b; };
      b.eq = (col: string, val: unknown) => (b.__update ? Promise.resolve({ error: null }) : b);
      b.single = () => Promise.resolve({ data: row, error: null });
      return b;
    },
  }),
}));

import { UserService } from '../../src/services/userService';

describe('UserService dashboard linking', () => {
  const svc = new UserService();
  beforeEach(() => { calls.length = 0; row = { auth_user_id: null }; });

  it('issues 8-digit codes and stores only their SHA-256 hash', async () => {
    const { code } = await svc.generateLinkCode('u1');
    expect(code).toMatch(/^[1-9]\d{7}$/);
    expect(calls[0].payload.link_code_hash).toBe(crypto.createHash('sha256').update(code).digest('hex'));
    expect(JSON.stringify(calls[0].payload)).not.toContain(code);
  });

  it('reports whether a profile is linked', async () => {
    expect(await svc.isLinked('u1')).toBe(false);
    row = { auth_user_id: 'auth-1' };
    expect(await svc.isLinked('u1')).toBe(true);
  });

  it('unlink clears the login and any pending code', async () => {
    await svc.unlink('u1');
    expect(calls[0].payload).toEqual({ auth_user_id: null, link_code_hash: null, link_code_expires_at: null });
  });
});
