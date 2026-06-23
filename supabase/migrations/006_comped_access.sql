-- Migration 006 : accès offert à vie (is_comped)
-- À exécuter dans Supabase → SQL Editor.
-- Un compte avec is_comped = true n'est JAMAIS bloqué et JAMAIS débité,
-- quel que soit l'état de l'essai ou de l'abonnement Stripe.

alter table public.user_settings
  add column if not exists is_comped boolean not null default false;

-- Grandfather : tous les comptes DÉJÀ créés bénéficient de l'accès offert à vie.
-- (les nouveaux comptes, eux, auront is_comped = false par défaut)
update public.user_settings set is_comped = true;
