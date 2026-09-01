-- Migration 030 : la mémoire visuelle d'une marque.
--
-- LE MANQUE QU'ELLE COMBLE
-- Le compositeur (`/api/compose-layout`) joint aujourd'hui DEUX images au
-- modèle de vision : les deux dernières publications du compte Instagram,
-- relues en direct à chaque génération. Trois défauts, tous mesurables :
--   1. « les deux dernières » n'est pas « les meilleures ». Une story de
--      remerciement floue pèse autant que le plus beau visuel de la marque ;
--   2. l'adresse d'un média Instagram est TEMPORAIRE. Une référence qui expire
--      fait échouer l'appel de vision, sans que rien ne le dise ;
--   3. rien de ce qui ne vient pas d'Instagram ne peut nourrir l'IA. Les
--      anciens designs Canva d'un client, qui sont précisément ce qu'il a de
--      mieux, n'ont aucun endroit où exister.
--
-- Cette table est cet endroit. Une référence est une image que la marque
-- assume, d'où qu'elle vienne, avec ce qu'on en a lu.
--
-- IMPORTANT : `image_url` doit pointer sur le Storage de KLIP, jamais sur le
-- CDN d'Instagram ni sur une adresse d'export Canva (valable 24 h). Une
-- référence qui expire est pire qu'une référence absente : elle casse
-- silencieusement la génération au lieu de la laisser tourner à vide.
create table if not exists public.brand_references (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- 'instagram' | 'canva' | 'upload'
  source       text not null default 'upload',
  -- Identifiant chez la source : média Instagram, design Canva. Sert à ne pas
  -- réimporter deux fois la même chose.
  source_id    text,
  image_url    text not null,
  thumb_url    text,
  -- Ce que la vision en a lu, dans les vocabulaires FERMÉS de KLIP (zone au
  -- sens de `recipeZone`, familles au sens de `DesignRecipe.family`). Écrire ici
  -- du texte libre reviendrait à redonner au modèle un vocabulaire qu'il
  -- réinvente à chaque appel.
  traits       jsonb,
  -- Une référence écartée reste en base : la réécarter au prochain import est
  -- exactement le genre de détail qui fait abandonner un outil.
  kept         boolean not null default true,
  -- Note de la marque sur ses propres visuels, quand elle en donne une.
  favori       boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists brand_references_ws_idx
  on public.brand_references(workspace_id, kept, favori desc, created_at desc);
create unique index if not exists brand_references_source_uniq
  on public.brand_references(workspace_id, source, source_id)
  where source_id is not null;

alter table public.brand_references enable row level security;

drop policy if exists "Users manage own brand references" on public.brand_references;
create policy "Users manage own brand references" on public.brand_references for all
  using (workspace_id in (select id from public.workspaces where user_id = auth.uid()))
  with check (workspace_id in (select id from public.workspaces where user_id = auth.uid()));
