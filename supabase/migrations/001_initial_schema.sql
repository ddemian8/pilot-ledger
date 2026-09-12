-- Pilot Ledger production schema for Supabase.
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  preferred_currency text not null default 'EUR' check (preferred_currency in ('EUR', 'MDL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  category text not null check (char_length(category) between 1 and 80),
  mode text not null check (mode in ('expense', 'income')),
  cents bigint not null check (cents > 0),
  currency text not null check (currency in ('EUR', 'MDL')),
  original_cents bigint not null check (original_cents > 0),
  original_currency text not null check (original_currency in ('EUR', 'MDL')),
  fx_rate numeric(12, 6),
  fx_date date,
  transaction_date date not null,
  receipt_text text,
  merchant text,
  business_type text,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  target_cents bigint not null check (target_cents > 0),
  saved_cents bigint not null default 0 check (saved_cents >= 0),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx on public.transactions(user_id, transaction_date desc);
create index if not exists goals_user_idx on public.goals(user_id, created_at asc);

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;

create policy "profiles owner read" on public.profiles for select using (auth.uid() = id);
create policy "profiles owner update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "transactions owner access" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals owner access" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
