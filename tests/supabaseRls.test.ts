import fs from 'fs';
import path from 'path';

// Repo-side half of the RLS check. The live half is supabase/rls_audit.sql, run against the database.
const dir = path.join(__dirname, '..', 'supabase');
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
const all = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && f !== 'rls_audit.sql');

const auditSql = read('rls_audit.sql');
const auditTables = (auditSql.slice(auditSql.indexOf('with tenant'), auditSql.indexOf('expected(tbl')).match(/'(\w+)'/g) ?? []).map(s => s.replace(/'/g, ''));
const createdTables = all.flatMap(f => [...read(f).matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/gi)].map(m => m[1]));

describe('supabase RLS definitions', () => {
  it('finds the tenant table list in rls_audit.sql', () => {
    expect(auditTables.length).toBeGreaterThanOrEqual(8);
  });

  it('rls_audit.sql lists every table the migrations create (users is checked separately)', () => {
    expect([...auditTables, 'users'].sort()).toEqual([...new Set(createdTables)].sort());
  });

  // The files that define the working, auth_user_id based policies
  const policyFiles = ['telegram_link.sql', 'recurrences_rls_fix.sql'];
  const policies = policyFiles.flatMap(f => [...read(f).matchAll(/create policy "([^"]+)" on public\.(\w+)\s+for (\w+)([\s\S]*?);/gi)]
    .map(m => ({ name: m[1], table: m[2], cmd: m[3].toUpperCase(), body: m[4] })));

  it.each(auditTables)('%s has a select, insert, update and delete policy that goes through auth_user_id', table => {
    const mine = policies.filter(p => p.table === table);
    for (const cmd of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const p = mine.find(x => x.cmd === cmd);
      expect(p).toBeDefined();
      expect(p!.body).toContain('auth_user_id');
    }
  });

  it('users is select-only', () => {
    const mine = policies.filter(p => p.table === 'users');
    expect(mine.map(p => p.cmd)).toEqual(['SELECT']);
  });

  it('every tenant table has row level security enabled somewhere in the repo', () => {
    const sql = all.map(read).join('\n');
    for (const t of [...auditTables, 'users']) {
      expect(sql).toMatch(new RegExp(`alter table (?:public\\.)?${t} enable row level security`, 'i'));
    }
  });
});
