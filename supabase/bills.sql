-- Create bills table
create table if not exists public.bills (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  amount numeric(10,2) not null check (amount > 0),
  due_date date not null,
  recurrence text null, -- e.g., 'monthly', 'weekly', 'yearly', or cron expression? We'll use simple text for now.
  paid boolean default false,
  paid_date date null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.bills enable row level security;

-- Create policy for users to insert their own bills
create policy "Users can insert their own bills" on public.bills
  for insert
  using (auth.uid() = user_id);

-- Create policy for users to select their own bills
create policy "Users can select their own bills" on public.bills
  for select
  using (auth.uid() = user_id);

-- Create policy for users to update their own bills
create policy "Users can update their own bills" on public.bills
  for update
  using (auth.uid() = user_id);

-- Create policy for users to delete their own bills
create policy "Users can delete their own bills" on public.bills
  for delete
  using (auth.uid() = user_id);

-- Trigger to set updated_at on update
create trigger update_bills_updated_at before update on public.bills
  for each row execute procedure moddatetime;
