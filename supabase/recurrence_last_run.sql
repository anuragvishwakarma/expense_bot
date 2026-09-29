-- Track last fire time so the scheduler runs each recurrence once per occurrence
alter table public.recurrences add column if not exists last_run_at timestamptz null;
