-- Adresse du site de la marque, saisie à la création de l'espace.
-- Elle sert à préremplir la charte (couleurs, typographie, positionnement) et
-- à pouvoir relancer l'analyse plus tard sans redemander l'adresse.
-- À exécuter avant de brancher la persistance côté formulaire.

alter table workspaces add column if not exists website_url text;
