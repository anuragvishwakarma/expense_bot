-- Create tags table
create table if not exists public.tags (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  color text default '#808080',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, name)
);

-- Create transaction_tags join table
create table if not exists public.transaction_tags (
  id uuid default uuid_generate_v4() primary key,
  transaction_id uuid references public.transactions(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (transaction_id, tag_id)
);

-- Enable RLS
alter table public.tags enable row level security;
alter table public.transaction_tags enable row level security;

-- Policies for tags
-- Users can insert their own tags
create policy "Users can insert their own tags" on public.tags
  for insert
  using (auth.uid() = user_id);

-- Users can select their own tags
create policy "Users can select their own tags" on public.tags
  for select
  using (auth.uid() = user_id);

-- Users can update their own tags
create policy "Users can update their own tags" on public.tags
  for update
  using (auth.uid() = user_id);

-- Users can delete their own tags
create policy "Users can delete their own tags" on public.tags
  for delete
  using (auth.uid() = user_id);

-- Policies for transaction_tags
-- Users can view transaction_tags for transactions they own
create policy "Users can view transaction tags" on public.transaction_tags
  for select
  using (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = transaction_id AND user_id = auth.uid()
    )
  );

-- Users can insert transaction_tags (they must own the transaction)
create policy "Users can insert transaction tags" on public.transaction_tags
  for insert
  using (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = transaction_id AND user_id = auth.uid()
    )
  );

-- Users can delete transaction_tags (they must own the transaction)
create policy "Users can delete transaction tags" on public.transaction_tags
  for delete
  using (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE id = transaction_id AND user_id = auth.uid()
    )
  );

-- Indexes for performance
create index if not exists idx_transaction_tags_transaction on public.transaction_tags (transaction_id);
create index if not exists idx_transaction_tags_tag on public.transaction_tags (tag_id);
