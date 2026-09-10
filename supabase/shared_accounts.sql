-- Alter accounts table to add owner_id (default to user_id for backward compatibility)
alter table public.accounts add column if not exists owner_id uuid not null default auth.uid();

-- Create account_members table for sharing accounts
create table if not exists public.account_members (
  id uuid default uuid_generate_v4() primary key,
  account_id uuid references public.accounts(id) on delete cascade,
  user_id uuid references auth.users not null,
  role text not null check (role in ('owner', 'member')) default 'member',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (account_id, user_id)
);

-- Enable RLS on new tables
alter table public.account_members enable row level security;

-- Policies for account_members
-- Users can view members of accounts they own or are member of
create policy "Users can view account members" on public.account_members
  for select
  using (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = account_id AND (owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.account_members WHERE account_id = public.accounts.id AND user_id = auth.uid()
      ))
    )
  );

-- Users can insert members (only owners can add members)
create policy "Users can add account members" on public.account_members
  for insert
  with check (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = account_id AND owner_id = auth.uid()
    )
  );

-- Users can update their own membership role? Only owners can change role; members can leave? We'll allow members to delete their own membership.
create policy "Users can update account members" on public.account_members
  for update
  using (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = account_id AND owner_id = auth.uid()
    )
  );

-- Users can delete account members (owners can remove any member; members can remove themselves)
create policy "Users can delete account members" on public.account_members
  for delete
  using (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = account_id AND owner_id = auth.uid()
    )
    OR (user_id = auth.uid())
  );

-- Existing accounts policies need to be updated to consider ownership via account_members
-- We'll replace the existing policies on accounts with new ones that check ownership or membership.

-- Drop existing policies on accounts if they exist (we'll recreate)
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Users can insert their own accounts') THEN
      EXECUTE 'DROP POLICY "Users can insert their own accounts" ON public.accounts';
   END IF;
   IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Users can select their own accounts') THEN
      EXECUTE 'DROP POLICY "Users can select their own accounts" ON public.accounts';
   END IF;
   IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Users can update their own accounts') THEN
      EXECUTE 'DROP POLICY "Users can update their own accounts" ON public.accounts';
   END IF;
   IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Users can delete their own accounts') THEN
      EXECUTE 'DROP POLICY "Users can delete their own accounts" ON public.accounts';
   END IF;
END $$;

-- New policies for accounts
-- Users can insert accounts (owner is the creator)
create policy "Users can insert their own accounts" on public.accounts
  for insert
  with check (auth.uid() = owner_id);

-- Users can select accounts they own or are member of
create policy "Users can select their own accounts" on public.accounts
  for select
  using (
    owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.account_members WHERE account_id = public.accounts.id AND user_id = auth.uid()
    )
  );

-- Users can update accounts they own
create policy "Users can update their own accounts" on public.accounts
  for update
  using (owner_id = auth.uid());

-- Users can delete accounts they own
create policy "Users can delete their own accounts" on public.accounts
  for delete
  using (owner_id = auth.uid());

-- Ensure owner_id is set for existing rows (backfill)
update public.accounts set owner_id = user_id where owner_id is null;
