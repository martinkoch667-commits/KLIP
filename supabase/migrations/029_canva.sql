-- Migration 029 : connexion Canva, au niveau du COMPTE et non du client.
--
-- POURQUOI SUR user_settings ET PAS SUR workspaces
-- Un community manager a UN compte Canva, dans lequel vivent les designs de
-- tous ses clients. Brancher la connexion sur le workspace obligerait à refaire
-- l'autorisation OAuth une fois par client, avec le même compte Canva à chaque
-- fois : quinze allers-retours pour quinze clients, et quinze jetons à
-- rafraîchir. La connexion se fait donc une fois, et c'est au moment d'importer
-- qu'on choisit dans quel client le design atterrit.
--
-- C'est l'inverse d'Instagram, et pour une raison de fond : un compte Instagram
-- APPARTIENT à un client, un compte Canva appartient à l'agence.
alter table public.user_settings
  add column if not exists canva_access_token text,
  add column if not exists canva_refresh_token text,
  add column if not exists canva_expires_at timestamptz,
  add column if not exists canva_connected_at timestamptz,
  -- Pour l'affichage : « connecté en tant que ... ». Jamais utilisé pour autoriser.
  add column if not exists canva_display_name text;

comment on column public.user_settings.canva_access_token is
  'Jeton d''accès Canva, chiffré au repos (lib/token-crypto.ts). Durée de vie 4 h.';
comment on column public.user_settings.canva_refresh_token is
  'Jeton de rafraîchissement Canva, chiffré au repos. À USAGE UNIQUE : Canva le fait tourner à chaque rafraîchissement et révoque toute la session si un ancien est rejoué. Il doit donc être réécrit à CHAQUE rafraîchissement, sans exception.';

-- ── D'où vient un modèle, et ce qu'il a coûté à l'import ────────────────────
--
-- Sans ces colonnes, un modèle importé est indiscernable d'un modèle dessiné
-- dans KLIP. Or ce n'est pas la même chose : un import porte une confiance, des
-- pertes assumées, et il peut être réimporté si le design change chez Canva.
alter table public.post_templates
  add column if not exists source text,
  add column if not exists source_id text,
  add column if not exists import_report jsonb;

comment on column public.post_templates.source is
  'D''où vient ce modèle : null (dessiné dans KLIP), ''canva'', ''pdf'', ''adn'' (proposé par l''analyse du compte Instagram).';
comment on column public.post_templates.source_id is
  'Identifiant du design Canva d''origine, pour pouvoir le réimporter quand il change.';
comment on column public.post_templates.import_report is
  'Rapport d''import (lib/canvaImport.ts) : blocs, polices, couleurs, pertes, confiance. Ce qui permet de dire à l''utilisateur ce qui n''a pas suivi, plutôt que de le lui laisser découvrir en modifiant son modèle.';

create index if not exists post_templates_source_idx on public.post_templates(workspace_id, source);
