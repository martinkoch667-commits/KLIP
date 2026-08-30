/* Identifiant du pixel Meta — source unique.

   Il était recopié à l'identique dans trois fichiers (le pixel navigateur, le
   bandeau de consentement, la Conversions API serveur). Le jour du changement
   de jeu de données, il fallait penser aux trois : en oublier un envoyait une
   partie des événements sur l'ancien pixel, sans que rien ne le signale.

   Ce n'est pas un secret : `NEXT_PUBLIC_` signifie que la valeur part dans le
   navigateur, et n'importe qui la lit dans le code source de la page.

   ATTENTION en changeant de pixel — deux choses ne suivent PAS toutes seules :

   1. `NEXT_PUBLIC_FB_PIXEL_ID` sur Vercel reste PRIORITAIRE. Si la variable y
      est renseignée avec l'ancien identifiant, c'est lui qui tourne en
      production et cette constante ne sert à rien. La mettre à jour, ou la
      supprimer pour que le repli ci-dessous s'applique.
   2. `META_CAPI_TOKEN` est délivré POUR UN JEU DE DONNÉES. Le jeton de
      l'ancien pixel sera refusé par le nouveau : les événements serveur
      échoueront en silence pendant que le pixel navigateur, lui, continuera
      d'émettre. Il faut en générer un nouveau dans le gestionnaire
      d'événements Meta.

   À ne pas confondre avec l'ID de l'app Facebook Login (1998010880798347),
   utilisé pour l'authentification OAuth : ce sont deux objets différents. */

/* Le pixel précédent portait l'identifiant 1390029399657000 (bascule du
   2026-08-30). Il est noté ici en commentaire et non exporté : une constante
   partirait dans le bundle navigateur pour rien, et brouillerait toute
   recherche de l'identifiant réellement actif. */

/** Jeu de données « KLIP Web » (Ensembles de données Meta). */
export const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "1109069111800010";
