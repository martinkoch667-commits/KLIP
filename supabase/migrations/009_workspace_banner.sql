-- Migration 009 : bannière personnalisée par client (workspace)
-- Remplace la barre de couleur "charte" par une image de bannière uploadable.
-- À exécuter dans Supabase → SQL Editor.

alter table public.workspaces
  add column if not exists banner_url text;
