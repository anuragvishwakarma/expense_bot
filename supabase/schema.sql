-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (links Telegram users to internal users)
create table users (
  id uuid primary key default uuid_generate_v4(),
  telegram_id bigint unique not null,
  username text,
  first_name text,
  last_name text,
  created_at timestamp with time zone default timezone('utc', now()) not null,
  updated_at timestamp with time zone default timezone('utc', now()) not null
);

-- Categories table for expense/income types
create table categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('expense', 'income')),
  icon text, -- emoji or icon identifier
  created_at timestamp with time zone default timezone('utc', now()) not null,
  unique(user_id, name, type)
);

-- Transactions table for expenses and income
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  category_id uuid references categories(id),
  amount decimal(10,2) not null,
  description text,
  date date not null default current_date,
  type text not null check (type in ('expense', 'income')),
  created_at timestamp with time zone default timezone('utc', now()) not null
);

-- Budgets table for monthly budget tracking
create table budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  category_id uuid references categories(id),
  amount decimal(10,2) not null,
  month integer not null check (month >= 1 and month <= 12),
  year integer not null,
  created_at timestamp with time zone default timezone('utc', now()) not null,
  unique(user_id, category_id, month, year)
);

-- Insert default categories
insert into categories (user_id, name, type, icon) values
-- Expense categories
('00000000-0000-0000-0000-000000000000', 'Food & Dining', 'expense', '🍽️'),
('00000000-0000-0000-0000-000000000000', 'Transportation', 'expense', '🚗'),
('00000000-0000-0000-0000-000000000000', 'Shopping', 'expense', '🛍️'),
('00000000-0000-0000-0000-000000000000', 'Entertainment', 'expense', '🎬'),
('00000000-0000-0000-0000-000000000000', 'Bills & Utilities', 'expense', '💡'),
('00000000-0000-0000-0000-000000000000', 'Healthcare', 'expense', '🏥'),
('00000000-0000-0000-0000-000000000000', 'Education', 'expense', '📚'),
-- Income categories
('00000000-0000-0000-0000-000000000000', 'Salary', 'income', '💰'),
('00000000-0000-0000-0000-000000000000', 'Freelance', 'income', '💻'),
('00000000-0000-0000-0000-000000000000', 'Investment', 'income', '📈'),
('00000000-0000-0000-0000-000000000000', 'Other Income', 'income', '💵')
on conflict do nothing;