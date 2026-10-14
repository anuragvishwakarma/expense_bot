-- Read-only RLS audit. Paste into the Supabase SQL editor (or psql). An EMPTY result means the live
-- database matches what the repo expects; every row returned is a problem to fix.
-- Run it after applying any supabase/*.sql file and after any dashboard changes to tables or policies.
-- It never changes data. When you add a tenant table, add it to the list below too (a jest test
-- fails until you do).

with tenant(tbl) as (
  values ('categories'), ('transactions'), ('budgets'), ('accounts'),
         ('debts'), ('goals'), ('recurrences'), ('user_reminders')
),
expected(tbl, cmd) as (
  select t.tbl, c.cmd from tenant t cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) c(cmd)
  union all select 'users', 'SELECT'
),
-- 1. any table in public without row level security
rls_off as (
  select 'RLS disabled' as problem, c.relname::text as table_name, 'public table has no row level security' as detail
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
),
-- 2. a verb with no policy (a policy for ALL covers every verb)
missing as (
  select 'missing policy', e.tbl, 'no ' || e.cmd || ' policy'
  from expected e
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = e.tbl and p.cmd in (e.cmd, 'ALL')
  )
),
-- 3. a policy that does not tie rows to the signed-in user through users.auth_user_id
-- (the original auth.uid() = user_id policies never match, because user_id is users.id)
wrong as (
  select 'wrong policy', p.tablename::text, p.policyname::text || ' (' || p.cmd || ') does not use auth_user_id'
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in (select tbl from expected)
    and position('auth_user_id' in coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) = 0
),
-- 3b. transactions and budgets writes must also check that the referenced category (and account) is the user's own
-- (supabase/ownership_checks.sql)
refs as (
  select 'no ownership check on references', p.tablename::text, p.policyname::text || ' (' || p.cmd || ') does not check the referenced rows'
  from pg_policies p
  where p.schemaname = 'public' and p.cmd in ('INSERT', 'UPDATE')
    and ((p.tablename = 'transactions' and (position('categories' in coalesce(p.with_check, '')) = 0 or position('accounts' in coalesce(p.with_check, '')) = 0))
      or (p.tablename = 'budgets' and position('categories' in coalesce(p.with_check, '')) = 0))
),
-- 4. users must stay read-only for a dashboard session, or a login could re-link itself
users_writable as (
  select 'users writable', 'users', p.policyname::text || ' allows ' || p.cmd
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'users' and p.cmd <> 'SELECT'
)
select * from rls_off
union all select * from missing
union all select * from wrong
union all select * from refs
union all select * from users_writable
order by 1, 2, 3;
