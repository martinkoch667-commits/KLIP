-- Migration 020 : suivi de l'expiration des tokens Instagram
-- À exécuter dans Supabase → SQL Editor.
--
-- Un token long-lived Instagram expire au bout de 60 jours. Jusqu'ici rien ne
-- mémorisait cette échéance : les comptes cessaient de publier deux mois après
-- leur connexion sans qu'aucun écran ne puisse le signaler. Ces colonnes
-- permettent au cron /api/cron/refresh-tokens de cibler les tokens à renouveler
-- et à l'écran Paramètres d'avertir avant la coupure.

alter table public.workspaces
  add column if not exists instagram_token_expires_at   timestamptz,
  add column if not exists instagram_token_refreshed_at timestamptz;

-- Le cron balaie les workspaces par échéance : index partiel sur les seuls
-- comptes réellement connectés.
create index if not exists workspaces_ig_token_expiry_idx
  on public.workspaces (instagram_token_expires_at)
  where instagram_access_token is not null;

-- Les comptes déjà connectés avant cette migration n'ont pas d'échéance connue.
-- On la pose à 60 jours après la connexion quand la date est connue, sinon à
-- 60 jours après maintenant : le cron les rafraîchira au prochain passage, ce
-- qui recalera la vraie valeur renvoyée par Meta.
update public.workspaces
   set instagram_token_expires_at = coalesce(instagram_connected_at, now()) + interval '60 days'
 where instagram_access_token is not null
   and instagram_token_expires_at is null;
