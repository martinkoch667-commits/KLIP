-- Migration 027 : l'offre Starter (1 client, 14,99 €/mois)
--
-- Deux notions vivaient dans la même colonne, et ça tenait tant qu'il n'y avait
-- que deux offres :
--   · account_type = le TYPE de compte. Il décide de la structure : membres
--     d'équipe, rôles Manager/Créa, création en lot. Deux valeurs, et ça ne
--     change pas ici : Starter est structurellement un compte solo.
--   · current_plan = l'OFFRE commerciale souscrite. C'est elle qui porte le
--     prix et le nombre de clients autorisés. Elle doit maintenant pouvoir
--     valoir 'starter', sinon un abonné Starter est indiscernable d'un abonné
--     Studio et se retrouve avec les 6 clients de Studio pour 14,99 €.
--
-- Sans cette migration, le webhook Stripe échouerait à écrire 'starter' et
-- l'abonnement d'un client payant ne serait pas activé. Le code sait retomber
-- sur 'solo' dans ce cas (voir app/api/stripe/webhook), mais c'est un filet,
-- pas une solution : la limite d'un client ne s'appliquerait pas.

alter table public.user_settings
  drop constraint if exists user_settings_current_plan_check;

alter table public.user_settings
  add constraint user_settings_current_plan_check
  check (current_plan is null or current_plan in ('starter', 'solo', 'agency'));

-- Les comptes existants n'ont jamais souscrit Starter : rien à rétro-remplir.
-- Ceux dont current_plan est resté nul continuent d'être lus via account_type
-- (getPlanFor dans lib/plans.ts), donc aucun compte ne change d'offre ici.

comment on column public.user_settings.current_plan is
  'Offre commerciale souscrite : starter | solo (Studio) | agency (Agence). '
  'Porte le prix et la limite de clients. À distinguer de account_type, qui '
  'porte la structure du compte (membres, rôles) et ne connaît que solo/agency.';
