const log: string[] = [];
let authUserId: string | null = 'auth-1';
let failTable: string | null = null;

jest.mock('../../src/db', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const b: any = {};
      b.select = () => b;
      b.single = () => Promise.resolve({ data: { auth_user_id: authUserId }, error: null });
      b.delete = () => { b.__op = 'delete'; return b; };
      b.update = (p: any) => { b.__op = `update ${JSON.stringify(p)}`; return b; };
      b.eq = () => {
        if (!b.__op) return b; // the select chain
        log.push(`${b.__op} ${table}`);
        return Promise.resolve({ error: failTable === table ? { message: 'boom' } : null });
      };
      return b;
    },
    auth: { admin: { deleteUser: async (id: string) => { log.push(`deleteUser ${id}`); return { error: null }; } } },
  }),
}));

import { AccountDeletionService, USER_TABLES_IN_DELETE_ORDER } from '../../src/services/accountDeletionService';

describe('AccountDeletionService', () => {
  beforeEach(() => { log.length = 0; authUserId = 'auth-1'; failTable = null; });

  it('deletes children before the things they reference, detaches the login, then removes the profile last', async () => {
    const r = await new AccountDeletionService().deleteEverything('u1');
    expect(r.loginDeleted).toBe(true);
    expect(log).toEqual([
      ...USER_TABLES_IN_DELETE_ORDER.map(t => `delete ${t}`),
      'update {"auth_user_id":null} users',
      'deleteUser auth-1',
      'delete users',
    ]);
    const i = (t: string) => log.indexOf(`delete ${t}`);
    expect(i('transactions')).toBeLessThan(i('accounts'));
    expect(i('transactions')).toBeLessThan(i('categories'));
    expect(i('budgets')).toBeLessThan(i('categories'));
    expect(i('recurrences')).toBe(0); // first, so the worker cannot post mid-delete
  });

  it('skips the login steps when the profile was never linked', async () => {
    authUserId = null;
    const r = await new AccountDeletionService().deleteEverything('u1');
    expect(r.loginDeleted).toBe(false);
    expect(log.some(l => l.startsWith('deleteUser'))).toBe(false);
    expect(log[log.length - 1]).toBe('delete users');
  });

  it('stops at the first failure, names the table, and keeps the profile so it can be retried', async () => {
    failTable = 'goals';
    await expect(new AccountDeletionService().deleteEverything('u1')).rejects.toThrow('Could not delete your goals');
    expect(log).not.toContain('delete users');
    expect(log.some(l => l.startsWith('deleteUser'))).toBe(false);
  });
});
