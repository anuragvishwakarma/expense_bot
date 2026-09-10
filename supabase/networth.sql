-- Create net worth snapshots table
create table if not exists public.networth_snapshots (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  net_worth numeric(15,2) not null,
  assets numeric(15,2) default 0 not null,
  liabilities numeric(15,2) default 0 not null,
  snapshot_date date not null default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.networth_snapshots enable row level security;

-- Create policy for users to insert their own snapshots
create policy "Users can insert their own net worth snapshots" on public.networth_snapshots
  for insert
  using (auth.uid() = user_id);

-- Create policy for users to select their own snapshots
create policy "Users can select their own net worth snapshots" on public.networth_snapshots
  for select
  using (auth.uid() = user_id);

-- Create policy for users to update their own snapshots (if needed)
create policy "Users can update their own net worth snapshots" on public.networth_snapshots
  for update
  using (auth.uid() = user_id);

-- Create policy for users to delete their own snapshots
create policy "Users can delete their own net worth snapshots" on public.networth_snapshots
  for delete
  using (auth.uid() = user_id);

-- Index for faster lookups by user and date
create index if not exists idx_networth_snapshots_user_date on public.networth_snapshots (user_id, snapshot_date);
