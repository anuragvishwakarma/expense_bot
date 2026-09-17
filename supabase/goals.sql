-- Create goals table
create table if not exists public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  name text not null,
  target_amount numeric(10,2) not null check (target_amount > 0),
  saved_amount numeric(10,2) default 0 not null check (saved_amount >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.goals enable row level security;

-- Create policy for users to insert their own goals
create policy "Users can insert their own goals" on public.goals
  for insert
  with check (auth.uid() = user_id);

-- Create policy for users to select their own goals
create policy "Users can select their own goals" on public.goals
  for select
  using (auth.uid() = user_id);

-- Create policy for users to update their own goals
create policy "Users can update their own goals" on public.goals
  for update
  using (auth.uid() = user_id);

-- Create policy for users to delete their own goals
create policy "Users can delete their own goals" on public.goals
  for delete
  using (auth.uid() = user_id);

-- Trigger to set updated_at on update
create trigger update_goals_updated_at before update on public.goals
  for each row execute procedure public.update_updated_at_column();