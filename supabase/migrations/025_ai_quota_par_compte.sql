-- Quota d'images par compte et par jour, en plus du plafond global.
--
-- Remplace 024 : cette migration recrée aussi la table globale si elle n'a
-- jamais été passée, et tout y est idempotent. La passer suffit, que 024 ait
-- été exécutée ou non.
--
-- Deux compteurs, deux rôles distincts :
--   ai_usage_daily       — tout le monde confondu, garde-fou de dernier recours
--   ai_usage_user_daily  — par compte, c'est lui qui borne un client donné
-- Le garde-fou à la minute (lib/ai-guard) reste en mémoire : il arrête une
-- boucle en une fraction de seconde, sans payer d'aller-retour en base.

create table if not exists public.ai_usage_daily (
  day    date    not null,
  kind   text    not null,
  count  integer not null default 0,
  primary key (day, kind)
);

create table if not exists public.ai_usage_user_daily (
  day     date    not null,
  user_id uuid    not null,
  kind    text    not null,
  count   integer not null default 0,
  primary key (day, user_id, kind)
);

-- Aucune policy : ces tables ne sont jamais lues depuis le navigateur, seulement
-- par la clé de service. RLS activé ferme donc complètement l'accès public.
alter table public.ai_usage_daily      enable row level security;
alter table public.ai_usage_user_daily enable row level security;

-- Incrémente les deux compteurs et renvoie leurs nouvelles valeurs, en un seul
-- aller-retour. L'atomicité est indispensable : deux générations simultanées
-- feraient perdre un point avec un lire-puis-écrire, et les plafonds
-- dériveraient silencieusement.
create or replace function public.bump_ai_quota(p_user uuid, p_kind text)
returns table (global_count integer, user_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  g integer;
  u integer;
begin
  insert into public.ai_usage_daily (day, kind, count)
  values (current_date, p_kind, 1)
  on conflict (day, kind) do update set count = ai_usage_daily.count + 1
  returning ai_usage_daily.count into g;

  insert into public.ai_usage_user_daily (day, user_id, kind, count)
  values (current_date, p_user, p_kind, 1)
  on conflict (day, user_id, kind) do update set count = ai_usage_user_daily.count + 1
  returning ai_usage_user_daily.count into u;

  global_count := g;
  user_count := u;
  return next;
end;
$$;

revoke all on function public.bump_ai_quota(uuid, text) from public, anon, authenticated;

-- L'ancienne fonction ne comptait que le global : plus rien ne l'appelle.
drop function if exists public.bump_ai_usage(text);
