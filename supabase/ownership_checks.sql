-- A dashboard session could previously insert or update its OWN transaction or budget while pointing
-- account_id / category_id at someone else's row (it needs that row's uuid, which is unguessable, but
-- nothing enforced the match). These policies also require every referenced account and category to
-- belong to the same user. The bot uses service_role and bypasses RLS; it checks ownership in code.
-- Idempotent: safe to run more than once. Apply after telegram_link.sql and accounts.sql.

drop policy if exists "Users can insert their own transactions" on public.transactions;
create policy "Users can insert their own transactions" on public.transactions
  for insert
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
    and (transactions.category_id is null or exists (
      select 1 from public.categories c where c.id = transactions.category_id and c.user_id = transactions.user_id))
    and (transactions.account_id is null or exists (
      select 1 from public.accounts a where a.id = transactions.account_id and a.user_id = transactions.user_id))
  );

drop policy if exists "Users can update their own transactions" on public.transactions;
create policy "Users can update their own transactions" on public.transactions
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()))
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
    and (transactions.category_id is null or exists (
      select 1 from public.categories c where c.id = transactions.category_id and c.user_id = transactions.user_id))
    and (transactions.account_id is null or exists (
      select 1 from public.accounts a where a.id = transactions.account_id and a.user_id = transactions.user_id))
  );

drop policy if exists "Users can insert their own budgets" on public.budgets;
create policy "Users can insert their own budgets" on public.budgets
  for insert
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
    and (budgets.category_id is null or exists (
      select 1 from public.categories c where c.id = budgets.category_id and c.user_id = budgets.user_id))
  );

drop policy if exists "Users can update their own budgets" on public.budgets;
create policy "Users can update their own budgets" on public.budgets
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()))
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
    and (budgets.category_id is null or exists (
      select 1 from public.categories c where c.id = budgets.category_id and c.user_id = budgets.user_id))
  );
