-- Audit M9: a signed-in user could edit their own balances and amounts through the API, because
-- the UPDATE policies let them. The app never updates these rows as the user: the bot uses the
-- service role (src/db.ts) and the dashboard's writes go through the service client
-- (dashboard/lib/deleteAccount.ts, the link route). So drop UPDATE from the API roles.
-- The UPDATE policies stay in place, and the service role is not affected by this revoke.
-- ponytail: if the dashboard ever updates a tenant row with the user's own session, grant the
-- specific columns back here instead of restoring the whole UPDATE privilege.
revoke update on public.categories, public.transactions, public.budgets, public.accounts,
  public.debts, public.goals, public.recurrences, public.user_reminders
  from anon, authenticated;
