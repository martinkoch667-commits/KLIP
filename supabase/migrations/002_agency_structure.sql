-- Migration 002: Agency structure
-- Tables: profiles (account_type), agencies, agency_members, client_assignments
-- Run in Supabase SQL editor or via supabase db push

-- ── 1. Add account_type to user_settings ─────────────────────────────────────
-- (user_settings created in migration 001)
alter table public.user_settings
  add column if not exists account_type text not null default 'solo'
    check (account_type in ('solo', 'agency'));

-- ── 2. agencies ──────────────────────────────────────────────────────────────
create table if not exists public.agencies (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  slug        text unique,
  created_at  timestamptz not null default now()
);

alter table public.agencies enable row level security;

-- Owner can do anything
create policy "agencies: owner all"
  on public.agencies
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── 3. agency_members ────────────────────────────────────────────────────────
create table if not exists public.agency_members (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (agency_id, user_id)
);

alter table public.agency_members enable row level security;

-- Agency owner can manage members
create policy "agency_members: owner all"
  on public.agency_members
  using (
    exists (
      select 1 from public.agencies a
      where a.id = agency_members.agency_id
        and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agencies a
      where a.id = agency_members.agency_id
        and a.owner_id = auth.uid()
    )
  );

-- Members can read their own row
create policy "agency_members: self select"
  on public.agency_members for select
  using (auth.uid() = user_id);

-- ── 4. client_assignments ────────────────────────────────────────────────────
-- Links a workspace (client) to an agency member who manages it
create table if not exists public.client_assignments (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  assigned_to  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (agency_id, workspace_id)
);

alter table public.client_assignments enable row level security;

-- Agency owner can manage assignments
create policy "client_assignments: owner all"
  on public.client_assignments
  using (
    exists (
      select 1 from public.agencies a
      where a.id = client_assignments.agency_id
        and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agencies a
      where a.id = client_assignments.agency_id
        and a.owner_id = auth.uid()
    )
  );

-- Assigned member can read their own assignment
create policy "client_assignments: assignee select"
  on public.client_assignments for select
  using (auth.uid() = assigned_to);
