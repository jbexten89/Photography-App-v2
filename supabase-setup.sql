-- ============================================================================
-- Jamie Bexten Photography — Supabase setup
-- Run this once in your Supabase SQL Editor (https://app.supabase.com → SQL).
--
-- NOTE: the live app uses `app_state_v2` (not `app_state`). This file
-- documents BOTH the original schema (kept for historical reference at the
-- bottom) and the v2 + snapshot tables actually in use today.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- app_state_v2: one row per authenticated user (live data, jsonb blob)
-- ----------------------------------------------------------------------------
create table if not exists public.app_state_v2 (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.app_state_v2 enable row level security;
drop policy if exists "app_state_v2_select_own" on public.app_state_v2;
drop policy if exists "app_state_v2_insert_own" on public.app_state_v2;
drop policy if exists "app_state_v2_update_own" on public.app_state_v2;
create policy "app_state_v2_select_own" on public.app_state_v2 for select using (auth.uid() = user_id);
create policy "app_state_v2_insert_own" on public.app_state_v2 for insert with check (auth.uid() = user_id);
create policy "app_state_v2_update_own" on public.app_state_v2 for update using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- app_state_snapshots_v2: rolling history of up to 30 snapshots per user
-- (Auto-snapshot feature — Settings → Snapshot History — added 2026-06.)
-- ----------------------------------------------------------------------------
create table if not exists public.app_state_snapshots_v2 (
  snapshot_id uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  state       jsonb not null,
  source      text default 'auto',   -- 'auto' | 'manual' | 'pre-restore'
  created_at  timestamptz not null default now()
);

create index if not exists app_state_snapshots_v2_user_idx
  on public.app_state_snapshots_v2 (user_id, created_at desc);

alter table public.app_state_snapshots_v2 enable row level security;
drop policy if exists "snapshots_select_own" on public.app_state_snapshots_v2;
drop policy if exists "snapshots_insert_own" on public.app_state_snapshots_v2;
drop policy if exists "snapshots_delete_own" on public.app_state_snapshots_v2;
create policy "snapshots_select_own" on public.app_state_snapshots_v2 for select using (auth.uid() = user_id);
create policy "snapshots_insert_own" on public.app_state_snapshots_v2 for insert with check (auth.uid() = user_id);
create policy "snapshots_delete_own" on public.app_state_snapshots_v2 for delete using (auth.uid() = user_id);

-- ============================================================================
-- LEGACY (kept for reference — the app no longer reads this table)
-- ============================================================================
create table if not exists public.app_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.app_state enable row level security;
drop policy if exists "app_state_select_own" on public.app_state;
drop policy if exists "app_state_insert_own" on public.app_state;
drop policy if exists "app_state_update_own" on public.app_state;
create policy "app_state_select_own" on public.app_state for select using (auth.uid() = user_id);
create policy "app_state_insert_own" on public.app_state for insert with check (auth.uid() = user_id);
create policy "app_state_update_own" on public.app_state for update using (auth.uid() = user_id);
