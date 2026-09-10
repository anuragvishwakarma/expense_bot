-- Create debts table
create table if not exists public.debts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  counterparty text not null, -- name or identifier of the other person
  amount numeric(10,2) not null check (amount > 0),
  type text not null check (type in ('lend', 'borrow')), -- lend: user lent money to counterparty, borrow: user borrowed from counterparty
  description text,
  settled boolean default false,
  settled_amount numeric(10,2) default 0 check (settled_amount >= 0 and settled_amount <= amount),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.debts enable row level security;

-- Create policy for users to insert their own debts
create policy "Users can insert their own debts" on public.debts
  for insert
  using (auth.uid() = user_id);

-- Create policy for users to select their own debts
create policy "Users can select their own debts" on public.debts
  for select
  using (auth.uid() = user_id);

-- Create policy for users to update their own debts
create policy "Users can update their own debts" on public.debts
  for update
  using (auth.uid() = user_id);

-- Create policy for users to delete their own debts
create policy "Users can delete their own debts" on public.debts
  for delete
  using (auth.uid() = user_id);

-- Trigger to set updated_at on update
create trigger update_debts_updated_at before update on public.debts
  for each row execute procedure moddatetime;