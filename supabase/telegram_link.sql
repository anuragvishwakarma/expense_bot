-- Link a Telegram bot user (public.users) to a dashboard login (auth.users),
-- and lock down direct table access now that the anon key is public and the
-- dashboard actually forwards the caller's session (see dashboard/lib/supabase.ts).
--
-- Run this once in the Supabase SQL editor.

-- One dashboard (Supabase Auth) account can link to one bot user, and vice versa.
alter table public.users add column if not exists auth_user_id uuid unique references auth.users(id);
-- sha256 of the one-time /link code, never the plaintext - so a DB read leak
-- doesn't hand out a live, redeemable code.
alter table public.users add column if not exists link_code_hash text;
alter table public.users add column if not exists link_code_expires_at timestamptz;

-- Users: a dashboard session can only see the bot-user row it's linked to.
alter table public.users enable row level security;

create policy "Users can select their own linked row" on public.users
  for select
  using (auth_user_id = auth.uid());

-- Categories, transactions, budgets had no RLS at all: with the anon key public
-- and no policy, anyone could read or write every user's rows via the REST API.
alter table public.categories enable row level security;

create policy "Users can select their own categories" on public.categories
  for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert their own categories" on public.categories
  for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update their own categories" on public.categories
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can delete their own categories" on public.categories
  for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

alter table public.transactions enable row level security;

create policy "Users can select their own transactions" on public.transactions
  for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert their own transactions" on public.transactions
  for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update their own transactions" on public.transactions
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can delete their own transactions" on public.transactions
  for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

alter table public.budgets enable row level security;

create policy "Users can select their own budgets" on public.budgets
  for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert their own budgets" on public.budgets
  for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update their own budgets" on public.budgets
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can delete their own budgets" on public.budgets
  for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- accounts/debts/goals already had RLS, but their policies compared auth.uid()
-- directly to user_id (the bot's users.id) - those never match, so these
-- tables were unreadable from the dashboard even when correctly linked.
-- Re-point them through the same auth_user_id indirection.
drop policy if exists "Users can insert their own accounts" on public.accounts;
drop policy if exists "Users can select their own accounts" on public.accounts;
drop policy if exists "Users can update their own accounts" on public.accounts;
drop policy if exists "Users can delete their own accounts" on public.accounts;

create policy "Users can insert their own accounts" on public.accounts
  for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can select their own accounts" on public.accounts
  for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update their own accounts" on public.accounts
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can delete their own accounts" on public.accounts
  for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

drop policy if exists "Users can insert their own debts" on public.debts;
drop policy if exists "Users can select their own debts" on public.debts;
drop policy if exists "Users can update their own debts" on public.debts;
drop policy if exists "Users can delete their own debts" on public.debts;

create policy "Users can insert their own debts" on public.debts
  for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can select their own debts" on public.debts
  for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update their own debts" on public.debts
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can delete their own debts" on public.debts
  for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

drop policy if exists "Users can insert their own goals" on public.goals;
drop policy if exists "Users can select their own goals" on public.goals;
drop policy if exists "Users can update their own goals" on public.goals;
drop policy if exists "Users can delete their own goals" on public.goals;

create policy "Users can insert their own goals" on public.goals
  for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can select their own goals" on public.goals
  for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update their own goals" on public.goals
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can delete their own goals" on public.goals
  for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));
