-- Migration 007 : plage de dates sur les liens de partage client
-- Permet d'envoyer au client un lien de validation limité à une période précise.
-- À exécuter dans Supabase → SQL Editor.

alter table public.share_tokens
  add column if not exists date_from timestamptz,
  add column if not exists date_to   timestamptz;
