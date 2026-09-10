-- Recurrences table
create table recurrences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  amount decimal(10,2) not null,
  description text not null,
  type text not null check (type in ('expense', 'income')),
  -- Simple interval representation: every N days, weeks, months
  interval_value integer not null check (interval_value > 0),
  interval_unit text not null check (interval_unit in ('day', 'week', 'month')),
  start_date date not null default current_date,
  end_date date, -- optional, nullable for indefinite
  active boolean not null default true,
  created_at timestamp with time zone default timezone('utc', now()) not null
);

-- User reminder preferences
create table user_reminders (
  user_id uuid primary key references users(id) on delete cascade,
  enabled boolean not null default false,
  reminder_time time not null default '21:00:00', -- time of day in UTC
  created_at timestamp with time zone default timezone('utc', now()) not null,
  updated_at timestamp with time zone default timezone('utc', now()) not null
);