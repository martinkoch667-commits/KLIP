-- ─── Colonnes de `posts` écrites par le code mais absentes du schéma ─────────
--
-- POURQUOI CE FICHIER EXISTE
-- `supabase/schema.sql` crée la table `posts` avec sept colonnes. Le code en
-- écrit bien davantage, et les migrations du dépôt n'en couvraient qu'une partie
-- (texte_visuel, editor_json, exported_image_url, instagram_post_id,
-- scheduled_at). Cinq colonnes étaient écrites sans jamais avoir été déclarées
-- nulle part : une base montée depuis le dépôt seul refusait donc l'insertion
-- d'un post, avec « column ... does not exist » — et le post était perdu.
--
-- À passer dans l'éditeur SQL de Supabase. Réexécutable sans risque.

-- Type de publication : 'post' | 'reel' | 'story' | 'carrousel'.
alter table posts add column if not exists post_type text default 'post';

-- Modèle appliqué au visuel (null = aucun).
alter table posts add column if not exists template_id uuid;

-- Timeline du module Montage (plans, sous-titres, audio…).
alter table posts add column if not exists montage_json jsonb;

-- Miniature de la vidéo, quand Instagram accepte de la prendre en compte.
alter table posts add column if not exists thumbnail_url text;

-- Validation par le client depuis le lien de prévisualisation partagé.
alter table posts add column if not exists approved_by_client boolean default false;

-- ─── Vérification ───────────────────────────────────────────────────────────
-- Doit renvoyer les cinq lignes ci-dessus :
--
--   select column_name, data_type
--   from information_schema.columns
--   where table_name = 'posts'
--     and column_name in ('post_type','template_id','montage_json','thumbnail_url','approved_by_client')
--   order by column_name;
