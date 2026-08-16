-- ─── Palette de marque étendue ──────────────────────────────────────────────
--
-- Les colonnes primary_color / secondary_color / accent_color ne portent que
-- TROIS couleurs. Une marque en a souvent plus, et l'extraction depuis le site
-- en trouvait jusqu'à cinq qu'on jetait faute d'endroit où les ranger.
--
-- Les trois premières restent dans leurs colonnes historiques — tout le code
-- existant s'appuie dessus — et la palette complète est stockée ici, plutôt que
-- d'ajouter une colonne par couleur.
--
-- À passer dans l'éditeur SQL de Supabase. Réexécutable sans risque.
-- (Sans elle, la création de client fonctionne quand même : la colonne est
--  traitée comme optionnelle et retirée à la volée si elle n'existe pas.)

alter table workspaces add column if not exists brand_colors jsonb default '[]'::jsonb;
