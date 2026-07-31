-- Familles typographiques complètes de la charte client.
--
-- Avant : deux colonnes (font_primary_url / font_secondary_url), donc UNE seule
-- graisse par police. Le client qui importait Archivo Regular + Bold + Italic
-- n'en gardait qu'une, et l'éditeur ne pouvait proposer que celle-là.
--
-- Après : brand_fonts stocke les familles entières, chacune avec ses variantes.
-- Forme attendue :
--   [
--     { "family": "Archivo",
--       "variants": [
--         { "weight": 400, "italic": false, "url": "https://…/Archivo-Regular.ttf" },
--         { "weight": 700, "italic": false, "url": "https://…/Archivo-Bold.ttf" }
--       ] }
--   ]
--
-- Les anciennes colonnes sont conservées : elles restent la police principale et
-- secondaire « par défaut » de la charte, et rien de l'existant ne casse.

alter table public.workspaces
  add column if not exists brand_fonts jsonb not null default '[]'::jsonb;

comment on column public.workspaces.brand_fonts is
  'Familles typographiques importées, avec toutes leurs graisses et italiques.';
