-- ─── Template de sous-titres par client — run in Supabase SQL Editor ────────
-- Safe to run multiple times (IF NOT EXISTS).
-- Stocke le style de sous-titres choisi à la création du client (ou dans les réglages).
-- Le montage lit cette valeur pour pré-appliquer le bon template (cf. charterSubDefault).
-- Valeurs = ids de SUB_STYLES : 'simple' | 'karaoke' | 'editorial' | 'clean' | 'mint'
--   | 'bold-white' | 'bold-yellow' | 'bold-mint' | 'bold-pink' | 'bold-blue'
--   | 'pill-black' | 'pill-acid' | 'pill-coral' | 'pill-violet'
alter table workspaces add column if not exists subtitle_style_id text;

-- Personnalisation libre du style (couleurs, police, graisse, pilule, contour…),
-- même forme que `subCustom` dans montage_json : {fg,hi,bg,stroke,font,weight,
-- italic,uppercase,pill,scale}. Fusionnée au style de base via effectiveSubStyle().
alter table workspaces add column if not exists subtitle_custom jsonb;

-- Position par défaut des sous-titres dans le cadre, en % ({x,y}) — réglée au
-- doigt sur l'aperçu vidéo de l'assistant. Défaut appliqué si absent : {50,84}.
alter table workspaces add column if not exists subtitle_pos jsonb;

-- Nombre de mots max par bloc de sous-titre (1, 2, 3, 4, 6 ou 99 = "Phrase"),
-- réglé à l'étape Personnaliser de l'assistant. Repris par défaut par
-- l'éditeur de montage pour les nouveaux projets de ce client (cf.
-- segmentCaptions / DEFAULT_WORDS_PER_CAPTION).
alter table workspaces add column if not exists subtitle_max_words integer;
