import type { TourStep } from "@/components/GuidedTour";

/* Les visites guidées, une par écran.

   Règle d'écriture : une étape ne décrit pas un bouton, elle répond à « je fais
   quoi maintenant ». Un tutoriel qui nomme les zones sans dire à quoi elles
   servent ne fait que retarder le moment où la personne se débrouille seule.

   Les étapes sans `target` s'affichent au centre : elles servent à présenter un
   écran avant d'en désigner les détails. Celles dont l'élément est absent sont
   retirées automatiquement (voir GuidedTour), donc un sélecteur qui ne
   correspond à rien fait disparaître son étape, il ne casse pas la visite. */

export const TOURS: Record<string, TourStep[]> = {
  /* ── Arrivée dans l'app ──────────────────────────────────────────────── */
  dashboard: [
    {
      title: "Bienvenue sur KLIP",
      body: "En deux minutes, le tour du propriétaire. À gauche, le rail : c'est le sommaire de l'app, il ne bouge jamais. Au centre, la page du moment, posée dessus. Vous pouvez passer à tout moment et relancer la visite depuis les réglages.",
    },
    {
      target: '[data-tour="hero"]',
      title: "L'état du jour",
      body: "L'accroche donne l'état du jour en une phrase, et les deux boutons mènent aux deux gestes les plus fréquents : composer, ou ouvrir le calendrier. Juste en dessous, quatre compteurs : ce qui part aujourd'hui, ce qui attend une validation, ce qui est programmé, et le nombre de clients.",
      placement: "bottom",
    },
    {
      target: '[data-tour="clients"]',
      title: "Un espace par client",
      body: "Vos clients vivent dans le rail, sous les pages : une pastille et un nom par marque. Chacune a sa charte, ses couleurs, ses logos, ses publications et son compte Instagram, et rien ne se mélange. S'il y en a plus que la hauteur de l'écran, la liste défile.",
      placement: "right",
    },
    {
      target: '[data-tour="new-post"]',
      title: "Créer un client",
      body: "Le « + » sous vos clients crée un espace. KLIP peut récupérer tout seul les couleurs, les polices et le logo depuis le site du client : vous n'aurez plus qu'à corriger ce qu'il a mal lu.",
      placement: "right",
    },
    {
      target: '[data-tour="composer"]',
      title: "Composer",
      body: "Vos brouillons en cours, tous clients confondus. On y reprend un contenu là où on l'a laissé, sans repasser par l'espace du client.",
      placement: "right",
    },
    {
      target: '[data-tour="calendar"]',
      title: "Le calendrier",
      body: "Tous vos clients sur une même grille, en semaine ou en mois. C'est ici qu'on repère les trous et qu'on déplace une publication d'un jour à l'autre. En haut, chaque client est une porte vers son propre calendrier, celui qui porte la validation et le lien de partage.",
      placement: "right",
    },
    {
      target: '[data-tour="feed"]',
      title: "Publications",
      body: "Sous « Publications », l'état réel de chaque contenu : programmé, publié, en échec. Si Instagram refuse une publication, c'est ici que vous le voyez, avec la raison.",
      placement: "right",
    },
    {
      target: '[data-tour="templates"]',
      title: "Templates",
      body: "Des mises en page réutilisables, rangées par client. Vous en créez une fois, vous la réutilisez pour tous les posts de cette marque, et la charte s'applique toute seule.",
      placement: "right",
    },
    {
      title: "Par quoi commencer",
      body: "Créez votre premier client avec le « + » du rail. Ensuite, importez une photo : KLIP compose le visuel à sa charte et rédige la légende. Vous n'avez plus qu'à relire.",
    },
  ],

  /* ── Éditeur visuel, post photo ──────────────────────────────────────── */
  editor: [
    {
      title: "L'éditeur visuel",
      body: "C'est ici que le post prend forme. Vous partez d'une photo, d'un modèle ou d'une page blanche, et vous repartez avec un visuel aux couleurs du client, prêt à publier.",
    },
    {
      target: ".ed-rail",
      title: "Les outils",
      body: "Photos, textes, formes, logos, stickers, calques. Chaque outil ouvre son panneau à gauche : vous cliquez, vous posez sur la page, vous ajustez. Quand un objet est sélectionné, ses réglages apparaissent sur la barre au-dessus du plan de travail.",
      placement: "right",
    },
    {
      target: ".ed-ai-btn",
      title: "Composer avec l'IA",
      body: "L'IA place les éléments à votre place, en respectant la charte du client et ses posts déjà validés. Elle ne dessine rien : elle compose à partir de vos visuels et de vos modèles. Relancez autant de fois que vous voulez, chaque essai propose une mise en page différente.",
      placement: "bottom",
    },
    {
      target: ".ed-topbar",
      title: "Annuler, vérifier, enregistrer",
      body: "Tout en haut : l'historique pour revenir en arrière, le format du post, la vérification qui relit le visuel, et « Publier ». Le bouton menu, à gauche, replie le rail : le plan de travail passe alors en plein écran. Votre travail est enregistré au fil de l'eau.",
      placement: "bottom",
    },
    {
      title: "Et la légende",
      body: "Le bouton de rédaction écrit la légende à partir de l'image et de la voix de la marque. Vous la corrigez, vous validez, et le post part vers le calendrier ou vers la validation du client.",
    },
  ],

  /* ── Montage vidéo ───────────────────────────────────────────────────── */
  montage: [
    {
      title: "Le montage vidéo",
      body: "De quoi monter un Reel sans sortir de KLIP : vous importez vos rushs, vous coupez, vous ajoutez les sous-titres et l'habillage, vous exportez. Aucun logiciel en plus.",
    },
    {
      target: ".mz-phone",
      title: "L'aperçu",
      body: "Le rendu final, au format du téléphone. Ce que vous voyez ici est exactement ce que verra l'abonné, marges de l'interface Instagram comprises.",
      placement: "right",
    },
    {
      target: ".mz-playbar",
      title: "La timeline",
      body: "Vos plans dans l'ordre. On y coupe, on déplace, on règle la durée. La lecture suit le curseur, et les coupes peuvent se caler automatiquement sur le rythme de la musique.",
      placement: "top",
    },
    {
      title: "Les sous-titres et l'habillage",
      body: "Les sous-titres sont générés à partir de la voix, puis mis à votre charte. L'habillage ajoute les titres à l'écran et les transitions selon le propos. Vous gardez la main sur chaque mot.",
    },
    {
      title: "Une fois exporté",
      body: "La vidéo rejoint le post comme n'importe quel visuel : légende, validation du client, programmation. Rien de particulier à faire.",
    },
  ],

  /* ── Programmation ───────────────────────────────────────────────────── */
  planning: [
    {
      title: "La programmation",
      body: "Ici, on décide quand chaque post part. KLIP publie tout seul à l'heure dite, y compris la nuit et le week-end.",
    },
    {
      target: ".topbar",
      title: "Semaine ou mois",
      body: "La vue semaine sert à caler les horaires au créneau près. La vue mois sert à vérifier le rythme : deux posts cette semaine, aucun la suivante, ça se voit tout de suite.",
      placement: "bottom",
    },
    {
      target: ".cal-slot",
      title: "Poser un post",
      body: "Cliquez un créneau libre pour y placer un contenu, ou glissez un post existant d'un jour à l'autre. L'heure se règle à la minute.",
      placement: "right",
    },
    {
      title: "Les meilleurs créneaux",
      body: "Les heures conseillées viennent de l'activité de l'audience du client. Ce sont des repères, pas une règle : votre connaissance du client passe devant.",
    },
    {
      title: "La validation du client",
      body: "Un post peut attendre l'accord du client avant de partir. Vous envoyez un lien, le client approuve ou commente sans créer de compte, et vous voyez sa réponse dans le fil.",
    },
  ],

  /* ── Modèles ─────────────────────────────────────────────────────────── */
  templates: [
    {
      title: "Les modèles",
      body: "Un modèle est une mise en page enregistrée : positions, textes, formes, emplacements d'image. Vous le réutilisez au lieu de tout refaire à chaque post.",
    },
    {
      target: ".tpl-grid",
      title: "Votre bibliothèque",
      body: "Vos modèles, ceux fournis avec KLIP, et ceux que vous avez créés pour ce client. Un clic ouvre l'éditeur avec la mise en page déjà en place.",
      placement: "top",
    },
    {
      title: "Les textes du modèle",
      body: "Les blocs de texte d'un modèle sont des emplacements : titre, accroche, mention. Quand vous réutilisez le modèle, vous remplacez le texte sans toucher à la mise en page, et la police et la couleur du client s'appliquent toutes seules.",
    },
    {
      title: "En faire un des vôtres",
      body: "Depuis l'éditeur, enregistrez n'importe quel visuel comme modèle. C'est ce qui fait gagner le plus de temps sur un client qu'on publie toutes les semaines.",
    },
  ],
};
