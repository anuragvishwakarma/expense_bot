-- Enable RLS on recurrences and user_reminders (were open to anyone with the public anon key).
-- The bot uses service_role and bypasses RLS.
alter table public.recurrences enable row level security;

create policy "Users can select their own recurrences" on public.recurrences
  for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert their own recurrences" on public.recurrences
  for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update their own recurrences" on public.recurrences
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can delete their own recurrences" on public.recurrences
  for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

alter table public.user_reminders enable row level security;

create policy "Users can select their own reminders" on public.user_reminders
  for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert their own reminders" on public.user_reminders
  for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update their own reminders" on public.user_reminders
  for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can delete their own reminders" on public.user_reminders
  for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));
