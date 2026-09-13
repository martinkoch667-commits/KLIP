-- Migration 031 : les compositions dessinées à la main, en base.
--
-- POURQUOI EN BASE ET PAS DANS LE CODE. Les 162 recettes vivent dans
-- `lib/designSystem.ts`, donc chaque ajout demande un déploiement. C'est tenable
-- quand on en écrit douze par mois ; ça ne l'est plus quand on en dessine
-- cinquante en un après-midi et qu'on en dérive deux cents. L'atelier écrit ici,
-- le compositeur lit ici, et le catalogue grandit sans passer par Vercel.
--
-- CE QUI EST STOCKÉ EST DÉJÀ TRADUIT. On n'enregistre pas le dessin de
-- l'éditeur (pixels, #FF4438, "Oswald") mais la RECETTE qui en sort
-- (`lib/templateVersRecette.ts`) : des fractions et des RÔLES de couleur et de
-- police. C'est cette traduction, et elle seule, qui fait qu'une composition
-- dessinée pour un restaurant se repeint correctement chez un avocat. Stocker
-- le dessin brut reviendrait à resservir le rouge du premier client à tous les
-- autres.
create table if not exists public.design_recipes (
  id           uuid primary key default gen_random_uuid(),

  -- Identifiant lisible, celui qui apparaît dans les journaux et dans
  -- `layout_feedback.recipe_id`. Unique : une recette remplacée garde son nom.
  recipe_id    text not null unique,

  name         text not null,
  family       text not null default 'maison',
  vibe         text[] not null default '{}',
  intents      text[] not null default '{}',
  sectors      text[],
  -- 'required' | 'optional' | 'none', comme `DesignRecipe.photo`.
  photo        text not null default 'required',
  description  text,

  -- Le dessin complet et les champs à remplir, au format `DesignNode[]` et
  -- `DesignSlot[]`. Du jsonb et non des colonnes : la forme d'un noeud évolue
  -- avec le système de design, et on ne migrera pas la base à chaque geste
  -- nouveau.
  nodes        jsonb not null,
  slots        jsonb not null default '[]',

  -- D'où elle vient : 'atelier' (dessinée à la main puis convertie) ou
  -- 'variante' (dérivée par `variantesRecette.ts`).
  source       text not null default 'atelier',
  -- Pour une variante : la composition dont elle est tirée, et le geste qui les
  -- sépare. Sans ça, deux cents variantes deviennent une liste anonyme où
  -- personne ne peut dire ce qui a été décliné de quoi.
  parent_id    text,
  geste        text,

  -- LA PORTÉE, et c'est la colonne qui protège les clients les uns des autres.
  -- 'client' : cette composition ne sert que le workspace qui l'a créée.
  -- 'catalogue' : elle entre dans le vivier de TOUT LE MONDE, repeinte à chaque
  -- charte. Une composition dessinée chez un client ne doit jamais devenir
  -- catalogue par accident, d'où le défaut à 'client'.
  portee       text not null default 'client',
  workspace_id uuid references public.workspaces(id) on delete cascade,

  -- Une composition écartée reste en base : la réécarter au prochain tour est
  -- exactement le genre de détail qui fait abandonner un outil.
  active       boolean not null default true,

  created_at   timestamptz not null default now()
);

create index if not exists design_recipes_vivier_idx
  on public.design_recipes(portee, active, family);
create index if not exists design_recipes_ws_idx
  on public.design_recipes(workspace_id, active);
create index if not exists design_recipes_parent_idx
  on public.design_recipes(parent_id);

alter table public.design_recipes enable row level security;

-- LECTURE : le catalogue est visible de tous ceux qui ont un compte, puisque
-- c'est précisément ce qu'il est ; les compositions de portée 'client' ne sont
-- visibles que par leur propriétaire.
drop policy if exists "Lire le catalogue et ses propres compositions" on public.design_recipes;
create policy "Lire le catalogue et ses propres compositions" on public.design_recipes for select
  using (
    (portee = 'catalogue' and active)
    or workspace_id in (select id from public.workspaces where user_id = auth.uid())
  );

-- ÉCRITURE : chacun chez soi. Passer une composition en 'catalogue' n'est PAS
-- une opération d'utilisateur — elle est réservée au service, donc à l'atelier
-- côté serveur. Sans cette restriction, n'importe quel compte pourrait pousser
-- ses dessins dans le vivier de tous les autres.
drop policy if exists "Gérer ses propres compositions" on public.design_recipes;
create policy "Gérer ses propres compositions" on public.design_recipes for all
  using (workspace_id in (select id from public.workspaces where user_id = auth.uid()))
  with check (
    workspace_id in (select id from public.workspaces where user_id = auth.uid())
    and portee = 'client'
  );

comment on column public.design_recipes.nodes is
  'DesignNode[] : le dessin en FRACTIONS du cadre, avec des RÔLES de couleur (brand, onBrand…) et de police (display, script…). Jamais de pixels ni de #hexa — c''est la traduction qui rend la composition réutilisable d''une marque à l''autre.';
comment on column public.design_recipes.portee is
  '''client'' : réservée au workspace qui l''a créée. ''catalogue'' : servie à tous, repeinte à chaque charte. Le passage à ''catalogue'' est réservé au service.';
