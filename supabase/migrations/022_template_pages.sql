-- Templates en plusieurs pages.
--
-- Un template ne décrivait qu'un seul plan de travail (`text_zones`). Depuis que
-- le carrousel n'est plus un type de post mais une publication à plusieurs pages,
-- un template doit pouvoir décrire ces pages-là, sinon on ne peut modéliser qu'un
-- carrousel « page 1 ».
--
-- `pages` contient TOUTES les pages, dans l'ordre :
--   [{ "elements": [...], "background_style": {...} | null }, ...]
-- `text_zones` reste la première page : le code plus ancien (et les templates
-- déjà enregistrés) continuent de fonctionner sans rien changer.
ALTER TABLE post_templates
  ADD COLUMN IF NOT EXISTS pages JSONB DEFAULT NULL;

COMMENT ON COLUMN post_templates.pages IS
  'Pages du template (carrousel). NULL = template une page, décrite par text_zones.';
