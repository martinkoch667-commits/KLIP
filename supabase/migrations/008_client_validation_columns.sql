-- Migration 008 : colonnes pour la validation client (lien de partage)
-- À exécuter dans Supabase → SQL Editor.
-- Sans ces colonnes, l'API /api/preview échoue silencieusement et renvoie 0 post.

alter table public.posts
  add column if not exists title               text,
  add column if not exists approved_by_client  boolean not null default false,
  add column if not exists client_comment      text,
  add column if not exists client_reviewed_at  timestamptz;
