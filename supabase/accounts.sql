-- Create accounts table
create table if not exists public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit', 'cash', 'investment', 'other')),
  currency_code char(3) not null default 'INR',
  starting_balance numeric(10,2) default 0 not null,
  current_balance numeric(10,2) default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.accounts enable row level security;

-- Create policy for users to insert their own accounts
create policy "Users can insert their own accounts" on public.accounts
  for insert
  with check (auth.uid() = user_id);

-- Create policy for users to select their own accounts
create policy "Users can select their own accounts" on public.accounts
  for select
  using (auth.uid() = user_id);

-- Create policy for users to update their own accounts
create policy "Users can update their own accounts" on public.accounts
  for update
  using (auth.uid() = user_id);

-- Create policy for users to delete their own accounts
create policy "Users can delete their own accounts" on public.accounts
  for delete
  using (auth.uid() = user_id);

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger to set updated_at on update
create trigger update_accounts_updated_at before update on public.accounts
  for each row execute procedure public.update_updated_at_column();

-- Add account_id to transactions table
alter table public.transactions add column if not exists account_id uuid references public.accounts(id);
