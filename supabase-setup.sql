-- ============================================================================
-- Jamie Bexten Photography — Supabase setup
-- Run this once in your Supabase SQL Editor (https://app.supabase.com → SQL).
-- Creates a single `app_state` table keyed by auth.users.id with a jsonb blob,
-- plus row-level-security policies so each user only sees their own row.
-- ============================================================================

-- app_state: one row per authenticated user
create table if not exists public.app_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Row Level Security — every statement must satisfy the policies below.
alter table public.app_state enable row level security;

-- Clean up any previous runs
drop policy if exists "app_state_select_own" on public.app_state;
drop policy if exists "app_state_insert_own" on public.app_state;
drop policy if exists "app_state_update_own" on public.app_state;

-- Users can read only their own row
create policy "app_state_select_own"
  on public.app_state
  for select
  using (auth.uid() = user_id);

-- Users can insert only rows keyed to themselves
create policy "app_state_insert_own"
  on public.app_state
  for insert
  with check (auth.uid() = user_id);

-- Users can update only their own row
create policy "app_state_update_own"
  on public.app_state
  for update
  using (auth.uid() = user_id);
