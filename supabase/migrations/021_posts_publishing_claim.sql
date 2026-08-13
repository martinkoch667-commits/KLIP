-- Migration 021 : réservation d'un post pendant sa publication
-- À exécuter dans Supabase → SQL Editor.
--
-- Le cron de publication passe désormais toutes les minutes, alors qu'un reel
-- peut occuper une exécution jusqu'à 150 s. Sans marqueur, les exécutions
-- suivantes reprendraient le même post — encore en statut « scheduled » — et le
-- publieraient deux ou trois fois sur le compte de l'utilisateur.
--
-- Cette colonne sert de réservation : une exécution ne traite un post que si
-- elle réussit à y poser sa date en une seule requête atomique. Le statut du
-- post ne change pas, il reste « scheduled » — les écrans Planning et Calendrier
-- continuent donc de l'afficher normalement pendant la publication.

alter table public.posts
  add column if not exists publishing_started_at timestamptz;

-- Le cron balaie les posts à publier : index partiel sur les seuls programmés.
create index if not exists posts_scheduled_publish_idx
  on public.posts (scheduled_at)
  where status = 'scheduled';
