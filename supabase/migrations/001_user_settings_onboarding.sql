-- Migration 001: user_settings table for onboarding state
-- Run this in your Supabase SQL editor or via supabase db push

create table if not exists public.user_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Enable RLS
alter table public.user_settings enable row level security;

-- Users can only read/write their own settings
create policy "user_settings: own row select"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "user_settings: own row insert"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "user_settings: own row update"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute procedure public.set_updated_at();
