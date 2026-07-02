# Handoff — KLIP · Module de Montage vidéo

> **À lire en premier.** Ce dossier est une **référence de design** produite en HTML/React (Babel in-browser). Ce n'est **pas** du code de production à copier tel quel. Ta mission : **recréer ce design de façon fonctionnelle dans le codebase KLIP existant**, avec ses patterns, son framework et ses librairies déjà en place (ou, si aucun environnement n'existe encore, choisir le framework le plus adapté). La charte visuelle, elle, doit être reproduite **à l'identique** (voir *Design tokens*).

---

## 1. Vue d'ensemble

KLIP est un outil de création de contenu pour réseaux sociaux (agences / marques).
Il possède déjà deux surfaces de création : **Composer** (rédaction du post) et
**Éditeur visuel** (retouche photo). Ce module ajoute une **troisième surface :
« Montage vidéo »** — un éditeur type CapCut pour assembler une vidéo courte
(Reel Instagram **9:16 vertical**) à partir de plusieurs rushes, avec
sous-titres automatiques, texte animé, audio, transitions, filtres, etc.

Le prototype propose **deux directions d'interface** commutables. **Une seule
sera retenue en production** — voir §3. Le reste (preview, outils, données,
charte) est commun aux deux.

**Fidélité : HIGH-FIDELITY.** Couleurs, typo, espacements et interactions sont
définitifs. À reproduire au pixel près avec les composants/librairies du codebase.

---

## 2. Emplacement dans l'app

Nouvel onglet dans la barre de navigation de création, à droite des deux existants :

```
[ Composer ]  [ Éditeur visuel ]  [ Montage vidéo ]   ← nouvel onglet
```

- Onglet actif : fond blanc, texte encre, ombre `--shadow-card`.
- Inactif : texte `--ink-2`, hover → `--ink`.
- Icône de l'onglet : caméra (`video`).

L'éditeur occupe tout le viewport sous une **topbar** (retour Composer, undo/redo,
nom du projet + badge format, Aperçu, Exporter).

---

## 3. Les deux directions (choisir-en UNE)

### Direction A — « Plan de travail » (éditeur multi-pistes)
Modèle **power-user**, proche d'un CapCut/Premiere. Fichier : `dir-a.jsx`.

- **Rail d'outils vertical** à gauche, fond forêt (dégradé menthe/acide), 9 outils
  + bouton IA en bas : Média, Découper, Texte, Sous-titres, Audio, Transitions,
  Filtres, Vitesse, Stickers.
- **Panneau de propriétés** (312px, blanc) qui change selon l'outil actif.
- **Preview 9:16** centrée.
- **Timeline multi-pistes** en bas (dock 246px) : 4 lanes empilées —
  Vidéo (blocs de clips bout à bout + pastilles de transition entre eux),
  Audio (waveform), Sous-titres (chips positionnés), Texte (chips + stickers).
  Règle temporelle, playhead synchronisé, zoom (px/seconde).

**Assemblage multi-clips :** blocs juxtaposés sur la lane Vidéo, largeur ∝ durée ;
pastille de transition cliquable entre deux blocs ; badge photo vs vidéo sur chaque
bloc.

### Direction B — « Séquence » (édition par transcript + scènes)
Modèle **guidé / éditorial**. Fichier : `dir-b.jsx`.

- **Barre d'outils contextuelle** horizontale en haut.
- **Colonne « Le script »** à gauche (348px) : le **transcript des sous-titres,
  éditable inline**. Cliquer un segment déplace la tête de lecture ; le segment en
  cours de lecture se surligne. **On monte en éditant le texte.**
- **Preview 9:16** au centre.
- **Inspecteur** à droite (326px) : par défaut liste les **calques de la scène
  sélectionnée** (Plan vidéo, Sous-titres, Texte, Filtre, Vitesse, Audio) →
  cliquer un calque ouvre son panneau de propriétés (mêmes panneaux que Dir A).
- **Ruban de scènes** en bas (156px) : vignettes 9:16 des scènes, dans l'ordre de
  lecture, **glisser pour réordonner**, pastilles de transition entre elles,
  bouton « + » pour ajouter une scène.

**Assemblage multi-clips :** chaque rush = une **scène** (vignette dans le ruban) ;
l'ordre du ruban = l'ordre de lecture ; les points colorés sur une vignette
indiquent les calques présents (sous-titres / texte / audio).

> Recommandation : **Direction B** est plus alignée avec l'ADN éditorial et aéré de
> KLIP et plus accessible aux non-monteurs ; **Direction A** parle aux utilisateurs
> avancés. À trancher côté produit. Le prototype permet de basculer via le sélecteur
> A/B en haut à droite (aussi exposé dans le panneau Tweaks).

---

## 4. Fonctionnalités à rendre RÉELLES

Le prototype **simule** ces comportements (données figées, minuteurs). En prod,
chacun doit être fonctionnel :

1. **Import médias** (vidéos + photos) depuis appareil/téléphone — drag & drop,
   MP4 / MOV / JPG.
2. **Assemblage multi-clips** bout à bout : réordonner, **découper/fractionner** au
   curseur, **rogner** les bords, dupliquer, supprimer.
3. **Incrustation photo** = plan fixe, durée réglable, mêmes transitions/filtres que
   la vidéo. Distinguer visuellement photo vs vidéo (badge).
4. **Sous-titres automatiques** : transcription IA de l'audio → texte **éditable mot
   à mot** + calage temporel + **4 styles animés** (Karaoké mot-par-mot, Éditorial,
   Net, Menthe). Le style karaoké surligne le mot prononcé (couleur `hi` du style).
5. **Texte & titres animés** : police, couleur, animation d'entrée (Apparition /
   Machine à écrire / Pop).
6. **Audio** : musique (bibliothèque de marque) + **voix off** (enregistrement micro),
   réglage des niveaux, option « caler les coupes sur le BPM ».
7. **Transitions** entre plans : Cut, Fondu, Glissé, Zoom, Balayage, Flou + durée.
8. **Filtres / étalonnage** par plan : filtres nommés + Lumière / Contraste / Saturation.
9. **Vitesse** par plan : 0.25× → 2×, ralenti lissé (interpolation), lecture inversée.
10. **Stickers & habillage** : éléments de marque, logo, barre de progression.
11. **Recadrage auto du sujet (IA)** : passer un plan en 9:16 en suivant le sujet.
12. **IA discrète** : montage automatique (premier jet à partir des rushes),
    suggestion de musique, recadrage. Overlay de génération pendant le traitement
    (`AIOverlay` dans `panels.jsx`).
13. **Lecture temps réel** : play/pause, scrubber, playhead synchronisé.
    → **Persister la position de lecture en `localStorage`** (survivre au refresh).
14. **Export** : rendu du Reel prêt à programmer dans le calendrier KLIP.

---

## 5. Interactions & comportements

- **Sélection** : cliquer un clip (A) ou une scène (B) le sélectionne (surbrillance
  menthe `0 0 0 2px var(--mint-2)`) et ouvre ses propriétés.
- **Lecture** : `usePlayback()` (dans `shared.jsx`) — requestAnimationFrame,
  boucle sur la durée totale (somme des durées de clips), remet à 0 en fin.
- **Scrubber** : clic/drag sur `.mz-scrub` → seek proportionnel.
- **Édition inline** : segments de transcript et lignes de sous-titres sont
  `contentEditable` ; on commit au blur.
- **IA** : `runAI(toastMessage, overlayLabel)` affiche l'overlay ~2,6 s puis un toast.
- **Toast** : confirmation éphémère en bas centre (~2,8 s).
- **Zoom timeline (A)** : boutons +/- ajustent `pps` (pixels par seconde, 20→80).
- **Transitions** : durée par défaut 0,4 s ; « Appliquer à tous les plans ».
- **Animations** : easing maison `cubic-bezier(.2,.7,.3,1)` ; panneaux entrent en
  fondu + léger translate ; respecter `prefers-reduced-motion`.

---

## 6. État (state) à prévoir

Le **state projet est la source de vérité** ; timeline et preview en sont des vues.

- `direction` : 'A' | 'B' (choix d'UI — figé en prod une fois tranché).
- `clips[]` : `{ id, kind:'video'|'photo', name, dur, filterId, speed, transitionIn,
  trimStart, trimEnd, src }` — **ordonnés** = ordre de lecture.
- `subtitles[]` : `{ id, start, end, text }` (issus de la transcription IA, éditables).
- `subStyleId` : 'karaoke' | 'editorial' | 'clean' | 'mint'.
- `titles[]` : `{ id, start, end, text, style, font, color, anim }`.
- `stickers[]` : `{ id, at, glyph|assetId, x, y }`.
- `audio` : `{ music:{trackId, vol}, vo:{src, vol}, snapToBeat:bool }`.
- `selection` : id du clip/scène sélectionné + éventuel calque/outil ouvert.
- `playback` : `{ time, playing }` (time persistée en localStorage).
- `pps` (Dir A) : zoom timeline.

Transitions d'état déclenchées par : import, découpe, réordonnancement (drag),
édition texte, changement de style/filtre/vitesse, actions IA (mutation par lot),
lecture.

Données : voir `data.jsx` (structures de référence) et `shared.jsx`
(`clipStarts()` calcule les temps de début cumulés, `clipAt/subAt/titleAt`).

---

## 7. Design tokens (charte KLIP — valeurs exactes)

Définis dans `base.css`. **Ne réinvente aucune valeur.**

**Surfaces**
- `--paper #F1F0E8` · `--canvas #F4F3EC` (fond app) · `--white/--card #FFFFFF`
- `--sunk #ECEBE1` (puits, tracks, wells)

**Forêt (sidebar / rail)**
- `--forest #0C2A1D` · `--forest-2 #103A28` · `--forest-3 #17492F`

**Encre & lignes**
- `--ink #14160F` · `--ink-2 #5A5E50` · `--ink-3 #8B8E7F`
- `--line rgba(13,15,10,.10)` · `--line-2 rgba(13,15,10,.06)`

**Sur fond forêt**
- `--cream #EEEDE3` · `--cream-2 …,.66` · `--cream-3 …,.34` · `--cream-4 …,.12`

**Accents**
- `--acid #C8F135` · `--mint #2FD79B` (action primaire) · `--mint-2 #21B381`
- `--mint-deep #0B3B2A` · `--mint-ink #06281C` · `--mint-soft rgba(47,215,155,.14)`

**Typographie**
- Display : `--display 'Archivo'` (titres, poids 700–900, souvent **italic** pour l'éditorial)
- Sans (texte) : `--sans 'Satoshi'` (400–900)
- Labels/mono : `--mono 'Cabinet Grotesk'` (700–900, uppercase, letter-spacing .12em)
- Serif d'accent (titres vidéo) : **Instrument Serif** (chargée dans le HTML)

**Rayons** : `--r-s 9px` · `--r 13px` · `--r-l 18px` · `--r-xl 24px`

**Ombres**
- `--shadow-card 0 1px 2px rgba(13,15,10,.04), 0 1px 0 rgba(13,15,10,.03)`
- `--shadow-pop 0 16px 40px -16px rgba(13,15,10,.28), 0 2px 8px rgba(13,15,10,.08)`
- `--shadow-float 0 22px 50px -24px rgba(13,15,10,.45)`

**Easing** : `cubic-bezier(.2,.7,.3,1)` (défini `--ease` dans `montage.css`).

**Cibles tactiles** ≥ 44px. Contrastes conformes AA.

---

## 8. Styles de sous-titres (référence)

Définis dans `data.jsx` → `SUB_STYLES`. Chaque style : `bg`, `fg` (texte), `hi`
(mot surligné), `weight`, `italic`, `pill` (bord arrondi plein).

- **Karaoké** : fond `#0C2A1D`, texte `#EEEDE3`, surlignage `#C8F135`, gras 800, pill.
- **Éditorial** : fond transparent, texte blanc, surlignage `#2FD79B`, italic Archivo 800.
- **Net** : bandeau blanc, texte `#14160F`, surlignage `#1F7A4D`, 700.
- **Menthe** : fond menthe translucide, texte `#06281C`, 800, pill.

Rendu : `SubtitleOverlay` dans `shared.jsx` (découpe en mots, calcule le mot
prononcé selon la progression temporelle du segment).

---

## 9. Assets

- **Aucune image réelle** : le prototype utilise des dégradés pour figurer les
  plans vidéo/photo. En prod → vraies vidéos/photos importées par l'utilisateur.
- **Icônes** : SVG inline dans `icons.jsx` (`VIcon`). À remplacer par le set
  d'icônes du codebase si équivalent, sinon réutiliser ceux-ci.
- **Polices** : Archivo (Google Fonts), Instrument Serif (Google Fonts), Satoshi +
  Cabinet Grotesk (Fontshare). Liens dans le `<head>` du HTML.
- **Logo KLIP** : composant `KlipMark` dans `icons.jsx` (à remplacer par le logo réel).

---

## 10. Fichiers de ce bundle (`design_files/`)

| Fichier | Rôle |
|---|---|
| `KLIP Montage vidéo.html` | Point d'entrée, ordre de chargement des scripts, `<head>` (polices, thumbnail) |
| `base.css` | Tokens de la charte KLIP + primitives (`.btn`, `.card`, sidebar…) |
| `montage.css` | Styles du module : topnav, rail, timeline, preview, panneaux, Dir A & B |
| `data.jsx` | Données de référence : `CLIPS`, `SUBS`, `TITLES`, `STICKERS`, `AUDIO`, `MUSIC_LIB`, `SUB_STYLES`, `FILTERS`, `TRANSITIONS`, `SPEEDS`, helpers `fmt` |
| `icons.jsx` | `VIcon` (set SVG), `KlipMark`, helpers couleur |
| `shared.jsx` | Preview 9:16 (`MZPreview`), lecture (`usePlayback`, `MZPlaybar`), sous-titres (`SubtitleOverlay`), temps cumulés des clips |
| `panels.jsx` | Topbar, overlay IA, `PanelBody` (panneaux de propriétés par outil, réutilisés A & B), `Range`, `Toggle` |
| `dir-a.jsx` | Direction A « Plan de travail » (timeline multi-pistes) |
| `dir-b.jsx` | Direction B « Séquence » (transcript + inspecteur + ruban) |
| `main.jsx` | Shell : onglets, sélecteur A/B, IA, toasts, panneau Tweaks |
| `tweaks-panel.jsx` | Panneau de réglages du prototype (non nécessaire en prod) |

**Ouvrir le prototype :** servir le dossier `design_files/` en HTTP statique et
ouvrir `KLIP Montage vidéo.html`. Basculer A/B via le sélecteur en haut à droite.

---

## 11. Notes techniques d'implémentation

- **Moteur de rendu vidéo** : le prototype ne rend pas de vraie vidéo. En prod,
  utilise le moteur existant du codebase s'il y en a un ; sinon **propose une
  approche avant de coder** (client : WebCodecs / `ffmpeg.wasm` ; ou rendu serveur)
  et fais-la valider.
- **Transcription / IA** : brancher sur le service IA de KLIP (transcription,
  suggestions). L'UI attend : texte + timings pour les sous-titres ; une liste de
  mutations d'état pour le « montage auto ».
- **Découpage en composants** : garder la séparation state / preview / panneaux
  d'outils. Les panneaux (`PanelBody`) sont partagés entre les deux directions —
  conserver ce partage si tu implémentes les deux, sinon ne garder que ceux de la
  direction retenue.
- **Responsive** : breakpoints dans `montage.css` (1280 / 1080px) masquent les
  labels du rail puis l'inspecteur. Adapter à tes contraintes.
