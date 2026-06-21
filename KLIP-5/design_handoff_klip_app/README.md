# Handoff — KLIP (refonte landing + application)

## Overview
KLIP est un SaaS de planification et publication de contenu Instagram, pensé pour les **agences de communication** qui gèrent plusieurs clients PME. Une agence gère, au même endroit : la création des visuels, la génération de descriptions assistée par IA, la planification, et la publication directe sur les comptes Instagram pro de chaque client.

Ce package couvre deux livrables de design :
1. **Landing page** (page d'accueil publique, avant connexion) — `KLIP Landing.html`
2. **Application** (produit connecté, post-login) — `app/KLIP App.html` et ses modules

Stack cible existante : **Next.js + Supabase, déployé sur Vercel**. Recréez ces designs dans cet environnement avec ses patterns établis (composants React, routing Next, données Supabase).

---

## À propos des fichiers de design
Les fichiers de ce bundle sont des **références de design réalisées en HTML/React (Babel in-browser)** — des prototypes qui montrent l'apparence et le comportement voulus, **pas du code de production à copier tel quel**. Le travail consiste à **recréer ces designs dans le codebase Next.js existant de KLIP**, en utilisant ses conventions (fichiers `.tsx`, Tailwind ou CSS modules selon le repo, composants serveur/client, appels Supabase réels). Les `*.jsx` ici utilisent React via Babel standalone + objets de style inline : c'est un véhicule de prototypage, à retranscrire proprement.

## Fidélité
**Haute fidélité (hifi).** Couleurs, typographie, espacements, rayons, ombres et interactions sont définitifs. Recréez l'UI au pixel près à partir des tokens listés plus bas. Les données (clients, posts, stats, abonnés) sont des **placeholders réalistes** — à remplacer par les vraies données Supabase / API Instagram Graph.

---

## Système de design (Design tokens)

### Couleurs
```
/* Surfaces */
--paper:     #F1F0E8   /* fond papier chaud (landing) */
--canvas:    #F4F3EC   /* fond workspace app */
--white:     #FFFFFF
--card:      #FFFFFF
--sunk:      #ECEBE1   /* puits/insets, pistes, skeletons */

/* Vert forêt (sections sombres, sidebar) */
--forest:    #0C2A1D
--forest-2:  #103A28   /* #103725 sur la landing */
--forest-3:  #16442F

/* Encre / texte */
--ink:       #14160F   /* #0D0F0A sur la landing */
--ink-2:     #5A5E50   /* texte secondaire */
--ink-3:     #8B8E7F   /* légendes / sous-texte */
--line:      rgba(13,15,10,.10)
--line-2:    rgba(13,15,10,.06)

/* Sur fond forêt */
--cream:     #EEEDE3
--cream-2:   rgba(238,237,227,.66)
--cream-3:   rgba(238,237,227,.34)
--cream-4:   rgba(238,237,227,.12)

/* Accents */
--acid:      #C8F135   /* vert acide (highlight, marquee landing) */
--acid-2:    #B4E01A
--acid-ink:  #1A2A05   /* texte lisible sur acide */
--mint:      #2FD79B   /* ACTION PRIMAIRE de l'app */
--mint-2:    #21B381   /* hover / texte menthe sur clair */
--mint-ink:  #06281C   /* texte sur menthe */
--mint-soft: rgba(47,215,155,.14)

/* Statut */
--warn:      #C8732B
--warn-soft: rgba(200,115,43,.14)
```
> Note : la **landing** utilise l'acide `#C8F135` comme accent principal ; l'**application** utilise la **menthe `#2FD79B`** comme couleur d'action primaire (boutons, états actifs), l'acide servant de touche secondaire (highlights, marqueur). Conserver cette distinction.

### Typographie
| Rôle | Police | Source | Usage |
|---|---|---|---|
| Display / titres | **Archivo** (800/900, + italique vraie 700-900) | Google Fonts | Titres, accroches, gros chiffres. Souvent en **UPPERCASE** sur la landing (`font-weight:900; letter-spacing:-0.015em`), et avec accents en *italique* couleur menthe/acide. |
| Labels / UI mono | **Cabinet Grotesk** (700/800/900) | Fontshare | Eyebrows, labels (`11px, letter-spacing:.12em, uppercase`), badges, libellés de jours. |
| Corps / légendes | **Satoshi** (400/500/700/900) | Fontshare | Texte courant, descriptions, légendes Instagram. |
| Serif (option landing) | **Gambetta** (400/700 + italique) | Fontshare | Disponible comme option de titre alternative (toggle Tweaks de la landing). |

Échelles typographiques clés :
- Display app titres de page : 28–36px / `.h-display` (Archivo 800, `letter-spacing:-0.03em`, `line-height:1.02`)
- Titres de carte : `.h-title` (Archivo 700, `-0.02em`)
- Chiffres / stats : `.num` (Archivo 800, `font-variant-numeric:tabular-nums`)
- Corps app : 14px / `line-height:1.5`
- Landing display hero : `clamp(36px, 4–7vw, 100px)`, `line-height:1.0`

### Espacement, rayons, ombres
```
--r-s: 9px    --r: 13px    --r-l: 18px    --r-xl: 24px   (app)
landing : --radius-s 12px / --radius 18px / --radius-l 28px

--shadow-card:  0 1px 2px rgba(13,15,10,.04), 0 1px 0 rgba(13,15,10,.03)
--shadow-pop:   0 16px 40px -16px rgba(13,15,10,.28), 0 2px 8px rgba(13,15,10,.08)
--shadow-float: 0 22px 50px -24px rgba(13,15,10,.45)

--sb-w: 256px (sidebar ; collapse à 76px sous 1080px)
Page max-width app : 1320px (1400 calendrier, 1180 composer, 980 file)
Landing max-width : 1180px
```

### Animations
- `screenIn` : fade + translateY(8px), .32s `cubic-bezier(.16,1,.3,1)` — transition d'écran
- `popIn` : scale(.96)→1, .18s — menus, toasts, vignettes
- `shimmer` : skeleton de chargement (génération IA en lot)
- `klip-ticker` : marquee landing, 32s linéaire
- Reveal au scroll (landing) : IntersectionObserver, opacity+translateY, gaté sur `prefers-reduced-motion`

---

## Partie 1 — Landing page (`KLIP Landing.html`)

Page marketing publique, fond papier clair avec **zones contrastées vert forêt**. Ton créatif mais lisible.

**Sections (dans l'ordre) :**
1. **Nav** fixe — logo Klip, liens (Le problème, Comment ça marche, Démo, Tarifs), "Se connecter", CTA "Essayer gratuitement". Devient opaque + blur au scroll.
2. **Hero** — gros titre Archivo uppercase + accent italique menthe ; collage de cartes de posts Instagram (« L'été se réserve maintenant », « Nouvelle carte », « Édition limitée », « On recrute. ») en éventail, avec petites étiquettes de workflow (Visuel, Description IA, Planifié, Publié). 2 variantes : `split` (défaut) et `centered`.
3. **Marquee** acide défilant (Créer · Planifier · Publier…).
4. **Problème** — zone **forêt sombre**, « Quatre outils. Trop d'allers-retours. » + 4 cartes outils (Canva, ChatGPT, tableur, Meta Business) + pastille « ≈ 2 h perdues par client/semaine ».
5. **Comment ça marche** — 3 étapes : (01) Importez vos photos → (02) L'IA met en forme → (03) Planifiez & publiez.
6. **Démo interactive** — zone forêt, mini-produit cliquable (importer photo → générer description avec voix de marque + machine à écrire → planifier).
7. **Fonctionnalités** — bento 6 tuiles : Éditeur visuel, Voix de marque, Descriptions IA, Calendrier éditorial, Un espace par client, Publication directe.
8. **Logos** agences (placeholders).
9. **Témoignages** — 1 grande citation forêt + 2 cartes.
10. **Tarifs** — toggle Mensuel/Annuel ; Solo (29€/24€) & Agence (79€/65€, mise en avant forêt).
11. **FAQ** — accordéon 6 questions.
12. **CTA final** — bloc acide pleine largeur.
13. **Footer** forêt.

> La landing intègre un panneau **Tweaks** (couleur d'accent, police de titre, variante hero, intensité des dégradés) — c'est un outil de prototypage, **à ne pas porter** en production.

---

## Partie 2 — Application (`app/KLIP App.html`)

Shell produit : **sidebar forêt fixe (256px) + topbar + zone workspace**. Routing par état (`route`), contexte client global (`active` = 'all' ou id client). Position mémorisée dans `localStorage` (`klip-route`).

### Architecture des fichiers (prototype)
| Fichier | Contenu |
|---|---|
| `app/data.jsx` | Données mock : `CLIENTS`, `POSTS`, `ACTIVITY`, `STATUS`, `TONES`, helpers `clientById`, `DOW`, `MONTH` |
| `app/app.css` | Tout le système de tokens + classes utilitaires (`.btn`, `.card`, `.chip`, `.badge`, `.avatar`, `.input`, `.seg`, `.nav-item`, `.label`, `.h-display`…) |
| `app/ui.jsx` | Primitives : `AIcon` (jeu d'icônes SVG), `Avatar`, `StatusBadge`, `KlipMark`, `PostMedia`, `PostCard`, `InstagramPreview` |
| `app/shell.jsx` | `Sidebar`, `Topbar`, `ClientSwitcher` |
| `app/screen-dashboard.jsx` | `Dashboard` + `StatTile` |
| `app/screen-calendar.jsx` | `Calendar` (vues mois + semaine), `MonthGrid`, `WeekGrid`, `PostChip`, `WeekCard` |
| `app/screen-editor.jsx` | `Editor` (éditeur visuel mono-post + mode `embedded`), helpers couleur `tint/shade/mix` |
| `app/screen-batch.jsx` | `BatchComposer` (création en lot), `ImportStep`, `ReviewStep`, `BatchItemCard` |
| `app/screen-queue.jsx` | `Queue` (file de publication + validation) |
| `app/screen-clients.jsx` | `Clients` + `ClientCard` |
| `app/main.jsx` | `KlipApp` (routing, contexte, toasts) |

### Écran : Tableau de bord (`dashboard`)
- **But** : vue d'ensemble agence ; ou espace d'un client si un client est sélectionné.
- **Layout** : header (salutation + titre `.h-display` avec accent italique menthe + actions « Calendrier » / « Composer avec l'IA ») → rangée de 4 **StatTiles** (grid 4 col) → grille 2 colonnes `1.55fr / 1fr`.
  - Gauche : « Prochaines publications » (4 `PostCard` en grille).
  - Droite : si **client sélectionné** → **`InstagramPreview`** (profil IG : avatar à anneau dégradé, posts/abonnés/abonnements, bio, onglets, grille 3×3 des posts) ; si **tous clients** → carte « Demande votre attention » (clients avec posts à valider) + « Activité récente ».
- **Interactions** : « Composer avec l'IA » → composer en lot ; clic client dans « attention » → sélectionne ce client ; tuiles de posts → éditeur.

### Écran : Calendrier (`calendar`)
- **But** : calendrier éditorial de tous les posts.
- **Vues** : **Mois** (grille 7 col, cellules 124px min, chips de posts colorées par client, jour courant en pastille menthe) et **Semaine** (7 colonnes-jours, cartes plus grandes avec vignette 16:10). Toggle segmenté Mois/Semaine.
- **Navigation** : en vue semaine, flèches préc./suiv. (clampées) + « Aujourd'hui ». Filtres clients par avatars (clic = toggle). Légende des statuts en bas.
- **Données** : septembre 2026, démarre un mardi (offset Lundi-first = 1, 30 jours).
- **À implémenter pour la prod** : glisser-déposer d'une chip de post pour replanifier (promis sur la landing, non implémenté dans le proto).

### Écran : Composer (`compose`) — création en lot ⭐
- **But** : créer plusieurs posts d'un coup. Point d'entrée du bouton « Nouveau post » et du nav « Composer ».
- **Flux 3 étapes** (`BatchSteps`) :
  1. **Importer** — dropzone (clic = ajoute des photos placeholder), grille des photos en attente (supprimables), panneau latéral : sélection client + voix de marque (Chic / Punchy / Minimal / Doux). CTA « Générer N descriptions ».
  2. **Générer** — animation décalée : chaque carte passe d'un skeleton shimmer à son contenu (accroche + légende générées selon la voix). Spinner « L'IA rédige vos posts… i/N ».
  3. **Peaufiner** — grille des posts générés (`BatchItemCard`) : aperçu visuel + accroche en overlay, légende (3 lignes max), badge ton, date/heure. Boutons « Éditer le visuel » (ouvre l'éditeur en mode `embedded`) et régénérer. Header : « Importer plus » + « Tout planifier ».
- **Header créatif** : bandeau forêt avec halos dégradés menthe/acide, titre Archivo + accent italique.

### Écran : Éditeur visuel (`editor`)
- **But** : composer/éditer **un** post. Atteint en éditant un post existant, ou en mode `embedded` depuis le composer en lot.
- **Layout 3 colonnes** : rail d'outils 64px (Média / Texte / Charte / Stickers) · stage canvas centrale · inspecteur droit 340px.
  - **Canvas** : format 4:5, fond dégradé, **accroche éditable inline** (`contentEditable`, Archivo italique), handle marque en haut.
  - **Média** : presets de fond dérivés de la couleur client + import.
  - **Texte** : couleur (palette marque) + position (Haut/Centre/Bas).
  - **Charte** : couleurs de marque (base + tint + shade), polices.
  - **Stickers** : glyphes.
  - **Bas d'inspecteur (toujours visible)** : génération **Description IA** (sélecteur de voix + bouton générer avec machine à écrire) puis **Planifier** (mini-semaine Lun-Dim, créneaux suggérés) → « Programmer la publication ». En mode `embedded` : bouton « Retour au lot » + « Enregistrer ce visuel ».
- **À implémenter pour la prod** : glisser-déposer réel du bloc texte sur le visuel (le proto annonce « glisse pour repositionner »), upload d'image réel.

### Écran : File de publication (`queue`)
- **But** : suivi des publications à venir + validation.
- **Layout** : bannière **connexion Instagram** (forêt, badge « Actif ») → onglets Tout / À valider / Planifiés (avec compteurs) → liste groupée par jour. Chaque ligne : vignette, client, heure, titre, légende, action.
- **Interactions** : posts « à valider » → boutons Voir + **Valider** (passe à « planifié », toast) ; « Gérer » la connexion IG ; menu « ··· » → ouvre l'éditeur.

### Écran : Clients (`clients`)
- **But** : grille des espaces clients.
- **`ClientCard`** : bandeau dégradé de marque, avatar débordant, nom + handle + secteur, 3 vignettes de posts, compteurs (planifiés / à valider), bouton « Ouvrir » (sélectionne le client). + carte « Nouvel espace client ».

---

## Composants transverses
- **Sidebar** : logo, nav principale (Tableau de bord, Calendrier, Composer, File de publication [badge à-valider], Clients), liste des clients (clic = sélectionne + va au dashboard ; pastille warn si posts en attente), Réglages, profil utilisateur. Collapse en rail d'icônes 76px sous 1080px.
- **Topbar** : `ClientSwitcher` (menu déroulant tous/par client avec compteurs), titre d'écran, recherche, cloche notifications, « Nouveau post ».
- **ClientSwitcher** : dropdown, fermeture au clic extérieur, ligne active en menthe-soft + coche.
- **Toast** : confirmation bas-centre, fond encre, pastille menthe ✓, auto-dismiss 3,2 s.
- **StatusBadge** : draft / pending (warn) / scheduled (forêt) / published (fond acide).

## Gestion d'état (prototype → à mapper sur Supabase/Next)
- `route` : écran courant (dashboard | calendar | compose | editor | queue | clients) — à remplacer par le routing Next.
- `active` : client sélectionné ('all' | clientId) — contexte global (Context/store).
- `editPost` : post en cours d'édition.
- `toastMsg` : message de confirmation transitoire.
- États locaux écran : étape du lot, photos en attente, brouillons générés, voix, jour/heure, vue calendrier + index semaine, onglet file, posts validés.
- **Données réelles à brancher** : clients & chartes, posts & statuts, comptes Instagram connectés (OAuth Meta / Instagram Graph API pour la publication), génération de descriptions (modèle IA), stats d'abonnés.

## Assets
- **Aucune image bitmap** : tous les visuels de posts sont des **dégradés CSS placeholders** → à remplacer par les vraies photos uploadées.
- **Icônes** : jeu SVG sur-mesure inline (`AIcon` dans `ui.jsx` ; `Icon` dans `landing-helpers.jsx`) — réutilisable ou à remplacer par la lib d'icônes du codebase.
- **Polices** : Archivo (Google Fonts), Cabinet Grotesk / Satoshi / Gambetta (Fontshare) — voir les `<link>` dans les fichiers HTML.
- **Logo** : wordmark texte « Klip » (composant `KlipMark` / `KlipLogo`), pas d'image.

## Fichiers de référence (dans `design_files/`)
- `design_files/app/KLIP App.html` + modules `app/*.jsx` + `app/app.css` → **l'application**
- `design_files/landing/KLIP Landing.html` + `styles.css` + `*.jsx` → **la landing**

Ouvrir les `.html` dans un navigateur pour voir les designs en fonctionnement.
