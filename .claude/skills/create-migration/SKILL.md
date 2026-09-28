---
name: create-migration
description: Use when adding a new Supabase table, or altering an existing one, in this repo — a new bot feature needs its own table, or an existing table needs a column/RLS change.
disable-model-invocation: true
---

# Create Migration

## Overview
This repo has no numbered migration tool — each feature owns one file in `supabase/`, applied by hand in the Supabase SQL editor. `schema.sql` is the base; `accounts.sql`, `goals.sql`, `debts.sql` etc. are additive per-feature files. Copy the pattern below exactly — every existing feature table follows it.

## Steps

1. **New file**: `supabase/<feature>.sql` (lowercase, matches the feature name, no number prefix).
2. **Table**: `create table if not exists public.<table> (...)`.
   - `id uuid default uuid_generate_v4() primary key`
   - `user_id uuid references public.users(id) not null` (every user-owned table has this)
   - domain columns, with `check (...)` constraints for enums/ranges (see `type in (...)` in `accounts.sql`, `target_amount > 0` in `goals.sql`)
   - `created_at timestamp with time zone default timezone('utc'::text, now()) not null`
   - `updated_at timestamp with time zone default timezone('utc'::text, now()) not null`
3. **Enable RLS**: `alter table public.<table> enable row level security;`
4. **Four policies**, one per operation, always scoped to the owner:
   ```sql
   create policy "Users can insert their own <table>" on public.<table>
     for insert with check (auth.uid() = user_id);
   create policy "Users can select their own <table>" on public.<table>
     for select using (auth.uid() = user_id);
   create policy "Users can update their own <table>" on public.<table>
     for update using (auth.uid() = user_id);
   create policy "Users can delete their own <table>" on public.<table>
     for delete using (auth.uid() = user_id);
   ```
5. **updated_at trigger** — reuse the existing function, don't redefine it:
   ```sql
   create trigger update_<table>_updated_at before update on public.<table>
     for each row execute procedure public.update_updated_at_column();
   ```
   (Function is defined once, in `accounts.sql`. Only add `create or replace function public.update_updated_at_column()...` again if that file hasn't been applied to the target DB yet.)
6. **Apply it**: paste the file into the Supabase SQL editor and run it. There's no CLI/CI migration runner here — confirm with the user before applying to a shared/production database.

## Why RLS still matters despite service_role

The bot (`src/db.ts`) connects with `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS — so the bot itself never hits these policies. They exist for the **dashboard**, which uses `@supabase/ssr` with the user's session (`auth.uid()`). Skip RLS on a new table and any dashboard page reading it gets nothing back (empty list, not an error) or, worse, a `42501` on write — that's a repo-documented past incident. Always add all four policies even if the dashboard only reads today; write policies get needed the moment a dashboard mutation ships.

## Common mistakes

| Mistake | Fix |
|---|---|
| Numbered migration file (`0007_add_x.sql`) | No such convention here — name by feature, not sequence |
| Forgot `enable row level security` | Table is world-readable/writable to any authenticated Supabase user until this runs |
| Only added `select` policy | Dashboard writes will 42501 the first time someone edits that data |
| Redefined `update_updated_at_column()` | Harmless (`create or replace`) but noisy — only needed if this is the first migration ever applied |
| Used `auth.uid()` thinking the bot enforces it | Bot writes via service_role and bypasses RLS entirely — RLS is dashboard-only protection |
