# Prompt pour Claude Design — Redesign de l'expérience de création KLIP

## Contexte produit
KLIP est un SaaS pour **community managers et agences** qui gèrent l'Instagram de plusieurs clients : import de photos, génération de légendes/visuels par IA, éditeur visuel (type Canva), calendrier, validation client, auto-publication. Stack : **Next.js 14 (App Router), React, TypeScript**. Le style est fait d'**inline styles + un fichier `app/globals.css`** (pas de Tailwind). L'éditeur visuel utilise **React Konva** (canvas).

Je veux que tu **redesignes l'expérience de création** pour qu'elle soit **premium, éditoriale, "agence créative"** — actuellement certaines zones font "trop IA / cheap / brut". Tu peux être **créatif**, mais tu dois **garder toutes les fonctionnalités et la logique existantes** (handlers, états, props) : tu ne touches qu'au **visuel / structure JSX / CSS / animations**.

## Charte & design system (à respecter scrupuleusement)
Tokens définis dans `app/globals.css` (`:root`) :
- Surfaces : `--canvas #F4F3EC`, `--paper #F1F0E8`, `--card #FFFFFF`, `--sunk #ECEBE1`
- Vert foncé (sidebar/forêt) : `--forest #0C2A1D`, `--forest-2 #103A28`
- Encre : `--ink #14160F`, `--ink-2 #5A5E50`, `--ink-3 #8B8E7F`, `--line rgba(13,15,10,.10)`
- Accents : `--mint #2FD79B`, `--mint-2 #21B381`, `--acid #C8F135`, `--mint-soft rgba(47,215,155,.14)`
- Typo : `--display 'Archivo'` (titres, bold, uppercase, letter-spacing négatif) · `--sans 'early-sans-variable'` (corps) · `--mono` (labels)
- Rayons : `--r-s 9px`, `--r 13px`, `--r-l 18px`, `--r-xl 24px`
- Sidebar : fond vert forêt, items crème.
ADN visuel : **éditorial / magazine**, beaucoup d'air, vert forêt + menthe, typo Archivo affirmée, coins arrondis doux, ombres subtiles, micro-animations fluides (easing `cubic-bezier(.2,.7,.3,1)`). Référence d'inspiration : la landing (composant `app/landing-view.tsx`, classe `.v2`) — garde cette élégance dans l'app.

## Zones à redesigner (avec les fichiers exacts)

### 1) Page Composer — `app/workspace/[id]/page.tsx`
C'est l'écran où on importe des photos puis génère le contenu. À refaire :
- **Les cartes de post** (`posts.map`, ~ligne 1090) : aperçu image, badge statut (`Validé`/`Brouillon`…), bouton suppression, badge type de post (Post/Reel/Story/Carrousel), sélecteur de template, champ brief, champ contexte, toggle "la photo contient déjà du texte", bouton "Générer".
- **État "généré"** de la carte : bloc **"Texte sur le visuel"** (éditable), bloc **"Légende Instagram"** (éditable) + champ "Affiner" (re-prompt), miniature pour les Reels, boutons "Éditer le visuel" / "Programmer".
- Les **états** : idle, génération (loading), généré, validé — chacun doit être clair et beau.
- **Objectif** : que ça ressemble à un vrai outil pro d'agence, pas à une démo IA. Hiérarchie nette, respiration, jolis labels, micro-animations à l'apparition et au survol.

### 2) Éditeur visuel — `app/workspace/[id]/editor/[postId]/page.tsx`
- **Barre du haut** (`.ed-topbar`) : retour, nom du client, sélecteur de format (Post/Reel/Story/Carrousel), boutons IA ("Composer (IA)", "Vérifier le rendu"), sélecteur de variantes (pastilles 1·2·3), "Aperçu", "Publier".
- **Rail d'outils gauche** (Modèles, Éléments, Texte, Photos, Charte, Importer, Calques, Plume).
- **Panneaux latéraux** de propriétés (quand on sélectionne un calque : typo, couleur, effets…).
- **Overlay de chargement IA** (déjà existant, à sublimer) : "L'IA Klip compose votre visuel".
- **Objectif** : barre et panneaux nets, typo Archivo sur les titres, séparateurs propres, micro-animations, identité menthe sur les actions IA.

### 3) Styles globaux — `app/globals.css`
Boutons (`.btn`, `.btn-primary`, `.btn-ghost`, `.btn-dark`), cartes (`.card`), inputs (`.input`), labels (`.label`), chips. Tu peux raffiner ces classes (et en ajouter) pour homogénéiser tout l'outil.

## Contraintes techniques (impératives)
- **Ne casse aucune fonctionnalité** : conserve tous les `onClick`, `value`/`onChange`, états React, refs, et la logique Konva. Tu réorganises/restylises le JSX, tu ne supprimes pas les comportements.
- Garde les **mêmes données affichées** (image, texte visuel éditable, légende éditable, badges, etc.).
- Reste en **inline styles + globals.css** (pas d'ajout de Tailwind/librairie UI).
- Mobile : ça doit rester responsive (la topbar de l'éditeur passe en icônes seules sous 1280px ; les cartes passent en 1 colonne sous 680px).
- Animations fluides mais **sobres** (pas de surcharge).

## Ce que je veux en sortie
Le JSX/CSS redesigné pour ces zones, prêt à coller, **fonctionnalités intactes**, avec un rendu **premium, éditorial, cohérent avec la charte KLIP**. Sois créatif sur la mise en forme, la hiérarchie, les micro-interactions et l'identité — mais sobre et pro, jamais "cheap".
