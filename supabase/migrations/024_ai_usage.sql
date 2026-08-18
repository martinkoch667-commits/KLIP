-- Consommation IA agrégée par jour, pour le plafond global de sécurité.
--
-- Volontairement SANS user_id : ce compteur ne sert pas à facturer ni à limiter
-- un client en particulier (le garde-fou par compte vit en mémoire, dans
-- lib/ai-guard). Il répond à une seule question : « combien d'images tout le
-- monde a-t-il généré aujourd'hui », pour couper avant que la facture Gemini ne
-- dérape. Pas de donnée personnelle, donc rien à purger côté RGPD.
create table if not exists public.ai_usage_daily (
  day    date    not null,
  kind   text    not null,
  count  integer not null default 0,
  primary key (day, kind)
);

-- Aucune policy : la table n'est jamais lue depuis le navigateur, uniquement
-- par la clé de service. RLS activé ferme donc complètement l'accès public.
alter table public.ai_usage_daily enable row level security;

-- Incrément atomique. Indispensable : deux générations simultanées feraient
-- perdre un point avec un lire-puis-écrire, et le plafond dériverait.
create or replace function public.bump_ai_usage(p_kind text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.ai_usage_daily (day, kind, count)
  values (current_date, p_kind, 1)
  on conflict (day, kind) do update set count = ai_usage_daily.count + 1
  returning ai_usage_daily.count into n;
  return n;
end;
$$;

revoke all on function public.bump_ai_usage(text) from public, anon, authenticated;
