-- Re-apply the recurrences / user_reminders RLS policies idempotently.
-- A live test (2026-10-14) showed a signed-in user could not read their own rows in these tables,
-- so the policies from recurrences_rls.sql were not active in production (fail-closed: no leak,
-- but the dashboard's "Upcoming recurring" widget read nothing). Safe to run more than once.
-- The bot uses service_role and bypasses RLS.

alter table public.recurrences enable row level security;
alter table public.user_reminders enable row level security;

drop policy if exists "Users can select their own recurrences" on public.recurrences;
create policy "Users can select their own recurrences" on public.recurrences
  for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

drop policy if exists "Users can insert their own recurrences" on public.recurrences;
create policy "Users can insert their own recurrences" on public.recurrences
  for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

drop policy if exists "Users can update their own recurrences" on public.recurrences;
create policy "Users can update their own recurrences" on public.recurrences
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

drop policy if exists "Users can delete their own recurrences" on public.recurrences;
create policy "Users can delete their own recurrences" on public.recurrences
  for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

drop policy if exists "Users can select their own reminders" on public.user_reminders;
create policy "Users can select their own reminders" on public.user_reminders
  for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

drop policy if exists "Users can insert their own reminders" on public.user_reminders;
create policy "Users can insert their own reminders" on public.user_reminders
  for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

drop policy if exists "Users can update their own reminders" on public.user_reminders;
create policy "Users can update their own reminders" on public.user_reminders
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

drop policy if exists "Users can delete their own reminders" on public.user_reminders;
create policy "Users can delete their own reminders" on public.user_reminders
  for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));
