-- Migration 018 : séquence d'emails pré-ouverture + sondage inscrits
-- À exécuter dans Supabase → SQL Editor.

-- ── 1) Désinscription + suivi des envois sur la liste d'attente ───────────────
alter table public.waitlist
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists last_campaign   int,
  add column if not exists last_sent_at    timestamptz;

comment on column public.waitlist.unsubscribed_at is 'Non nul = désinscrit·e, exclu·e de tous les envois (obligation RGPD).';
comment on column public.waitlist.last_campaign  is 'Numéro du dernier mail de séquence envoyé (1..5).';

-- ── 2) Réponses au sondage ───────────────────────────────────────────────────
create table if not exists public.waitlist_survey (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  role          text,          -- freelance | agence | interne | createur | autre
  clients       text,          -- 0 | 1 | 2-3 | 4-8 | 9+
  pains         text[],        -- ce qui prend le plus de temps (multi)
  tools         text,          -- outils actuels (libre)
  wish          text,          -- ce qui leur a donné envie de s'inscrire (libre)
  budget        text,          -- <20 | 20-40 | 40-80 | 80+ | ne-sais-pas
  created_at    timestamptz not null default now()
);

-- Une réponse par email : une nouvelle soumission écrase l'ancienne (upsert).
-- Index sur la colonne (et non sur lower(email)) : PostgREST a besoin d'une
-- contrainte sur la colonne elle-même pour `onConflict`. L'API force déjà la
-- minuscule avant l'écriture.
create unique index if not exists waitlist_survey_email_unique
  on public.waitlist_survey (email);

-- RLS activé : les écritures passent UNIQUEMENT par l'API serveur (service_role).
alter table public.waitlist_survey enable row level security;
