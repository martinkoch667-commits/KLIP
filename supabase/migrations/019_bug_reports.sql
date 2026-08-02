-- Migration 019 : signalements de bugs (phase d'ouverture)
-- À exécuter dans Supabase → SQL Editor.

create table if not exists public.bug_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  kind        text not null default 'bug',   -- bug | idee | autre
  message     text not null,
  page_url    text,          -- où l'utilisateur se trouvait
  user_agent  text,
  status      text not null default 'nouveau', -- nouveau | en-cours | corrige | ignore
  created_at  timestamptz not null default now()
);

create index if not exists bug_reports_created_idx on public.bug_reports (created_at desc);
create index if not exists bug_reports_status_idx  on public.bug_reports (status);

-- RLS activé : les écritures passent UNIQUEMENT par l'API serveur (service_role).
alter table public.bug_reports enable row level security;
