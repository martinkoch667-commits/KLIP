-- Migration 010 : liste d'attente / accès anticipé (pré-ouverture)
-- À exécuter dans Supabase → SQL Editor.

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  name        text,
  instagram   text,
  company     text,          -- agence / type d'activité / nb de clients
  source      text,          -- provenance (campagne, réseau…)
  created_at  timestamptz not null default now()
);

-- Un email = une inscription
create unique index if not exists waitlist_email_unique on public.waitlist (lower(email));

-- RLS activé : les écritures passent UNIQUEMENT par l'API serveur (service_role).
alter table public.waitlist enable row level security;
