-- Ce que le client RETIENT parmi les propositions de l'IA.
--
-- Le compositeur propose trois mises en page et n'apprenait rien de ce qui était
-- gardé : la même recette pouvait être écartée cent fois sans jamais perdre du
-- terrain. Chaque choix est désormais enregistré, et le compositeur s'en sert au
-- tour suivant — c'est la seule boucle par laquelle l'outil s'améliore vraiment
-- pour un client donné, plutôt qu'en moyenne pour tout le monde.
CREATE TABLE IF NOT EXISTS layout_feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id      UUID REFERENCES posts(id) ON DELETE SET NULL,
  -- Identifiant de la recette de la bibliothèque, ou du template maison retenu.
  recipe_id    TEXT NOT NULL,
  -- 'library' | 'template' : d'où venait la mise en page choisie.
  source       TEXT NOT NULL DEFAULT 'library',
  -- Rang de la variante retenue (1, 2 ou 3) — dit aussi si la première proposition
  -- suffisait, ce qui est en soi une mesure de la qualité du premier jet.
  variant      INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS layout_feedback_workspace_idx ON layout_feedback(workspace_id, created_at DESC);

ALTER TABLE layout_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own layout feedback" ON layout_feedback;
CREATE POLICY "Users manage own layout feedback" ON layout_feedback FOR ALL
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));
