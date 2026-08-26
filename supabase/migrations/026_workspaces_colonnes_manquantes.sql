-- Remet la table `workspaces` au niveau du code.
--
-- POURQUOI CETTE MIGRATION EXISTE
-- L'enregistrement de la charte échouait ENTIÈREMENT en production, et depuis
-- longtemps : PostgREST répondait « Could not find the 'banner_url' column of
-- 'workspaces' in the schema cache ». Ni la police, ni les couleurs, ni le ton
-- n'étaient jamais écrits. Personne ne l'avait vu parce que la page affichait
-- « Charte mise à jour ✓ » sans lire le résultat de la requête (corrigé dans
-- d5e9b24).
--
-- La base de production est en retard de plusieurs migrations, et PostgREST ne
-- signale qu'UNE colonne manquante à la fois : corriger `banner_url` seul ne
-- ferait qu'exposer la suivante. Ce fichier ajoute donc, en une passe, TOUTES
-- les colonnes que l'application écrit ou lit sur `workspaces`.
--
-- STRICTEMENT ADDITIF ET IDEMPOTENT : `add column if not exists` ne touche pas
-- une colonne déjà là, quel que soit son type. On peut le rejouer sans risque,
-- sur n'importe quel état de la base.
--
-- `brand_assets` est déclarée `jsonb` ici et `text[]` dans de vieux scripts
-- (`add-brand-charter.sql`). On ne tente aucune conversion : si la colonne
-- existe déjà, sous l'un ou l'autre type, elle est laissée telle quelle. Les
-- deux se lisent correctement côté client (`Array.isArray`).

alter table public.workspaces
  -- Identité
  add column if not exists sector              text,
  add column if not exists company_description text,
  add column if not exists instagram_username  text,

  -- Voix de la marque
  add column if not exists tone                text,
  add column if not exists words_to_use        text,
  add column if not exists words_to_avoid      text,
  add column if not exists caption_examples    text,
  add column if not exists brand_voice_prompt  text,

  -- Couleurs
  add column if not exists primary_color       text,
  add column if not exists secondary_color     text,
  add column if not exists accent_color        text,

  -- Images de marque
  add column if not exists logo_url            text,
  add column if not exists logo_dark_url       text,
  add column if not exists banner_url          text,
  -- Jamais migrée nulle part : elle n'existait que dans le code.
  add column if not exists brand_icon_url      text,
  add column if not exists brand_assets        jsonb default '[]'::jsonb,

  -- Typographie
  add column if not exists font_family         text,
  add column if not exists font_secondary      text,
  add column if not exists font_primary_url    text,
  add column if not exists font_secondary_url  text,
  -- Les familles entières, avec toutes leurs graisses (cf. 017).
  add column if not exists brand_fonts         jsonb not null default '[]'::jsonb,
  -- Polices téléversées depuis l'éditeur, sérialisées en JSON.
  add column if not exists custom_fonts        text;

comment on column public.workspaces.brand_icon_url is
  'Icône de marque (pastille), utilisée dans les visuels générés.';
