-- L'ADN VISUEL D'UNE MARQUE, relevé sur ce qu'elle publie déjà.
--
-- Jusqu'ici, le terrain de couleur d'un client (`lib/colorway.ts`) et son
-- identité typographique (`lib/typeIdentity.ts`) étaient choisis par une
-- EMPREINTE DE SON NOM, corrigée par le secteur et le ton déclarés. C'est
-- stable, c'est mieux que la constante unique d'avant, mais il faut le dire
-- comme c'est : deux marques reçoivent des terrains différents parce que leurs
-- noms hachent différemment, pas parce qu'on a regardé leur travail.
--
-- Cette colonne porte le résultat de l'analyse du compte Instagram : la palette
-- mesurée, la lecture du style, et surtout les deux décisions qui remplacent le
-- tirage au sort (`colorwayId`, `typeIdentityId`). Le compositeur la lit à
-- chaque génération.
--
-- Une seule colonne jsonb, et pas une table : c'est un fait unique par
-- workspace, réécrit à chaque nouvelle analyse, jamais historisé. Le jour où on
-- voudra suivre l'évolution d'un fil dans le temps, ce sera une autre table et
-- une autre conversation.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS visual_dna JSONB;

COMMENT ON COLUMN workspaces.visual_dna IS
  'ADN visuel mesuré sur le compte de la marque (lib/brandDNA.ts) : metrics, vibes, register, colorwayId, typeIdentityId, zones, families, motifs, gaps, brandColors. Écrit par /api/brand-dna, lu par /api/compose-layout.';
