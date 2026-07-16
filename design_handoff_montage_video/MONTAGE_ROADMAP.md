# Roadmap Montage vidéo Klip — vers un éditeur type CapCut

> Notes de spec issues du brief vocal de Martin (2026-07-16).
> Point de départ : `app/workspace/[id]/montage/[postId]/` (page.tsx ~1700 l., panels.tsx,
> constants.ts, export.ts). Modèle actuel : clips vidéo en séquence (pas d'offset libre),
> 1 couche overlay PIP, listes séparées (captions/titles/stickers/audioTracks), pas de
> pistes empilables.

## Légende
- 🔑 = brique architecturale clé de voûte (bloque d'autres items)
- 🎨 = réutilise l'éditeur visuel « Canva » existant
- 🤖 = IA / backend

---

## A. Importation des médias
- **A1** — Page d'import : séparer explicitement « Importer des photos » / « Importer des vidéos ».
- **A2** — Import groupé par montage : l'utilisateur déclare « ces X rushs = un même montage »,
  importe ses 5–6 vidéos, et au dépôt dans la timeline **tous les rushs se posent bout à bout
  automatiquement** (une section = un montage).

## B. 🔑 Timeline multi-pistes & positionnement libre (KEYSTONE)
- **B1** — Déplacement **libre** des clips dans le temps (offset) : pouvoir laisser du vide /
  écran noir au début et entre les clips. (Aujourd'hui : clips collés, pas d'offset.)
- **B2** — Réordonnancement : ✅ déjà présent.
- **B3** — Vidéo + audio **liés par défaut** (même média). Clic droit → « Détacher l'audio » →
  la piste son devient indépendante sur la timeline. (Screenshot CapCut à venir de Martin.)
- **B4** — **Pistes multiples illimitées**, vidéo ET audio. Bouton « + ajouter une piste ».
  Permet de superposer les vidéos.
- **B5** — Images, textes, stickers et autres éléments se posent **sur les pistes vidéo**
  (plus de piste « texte » express séparée) — on les glisse par-dessus les pistes vidéo.
- **B6** — Sous-titres = **seule** piste dédiée. Ordre vertical de la timeline :
  **audio (bas) → vidéo + éléments (milieu) → sous-titres (haut)**.

## C. Sous-titres
- **C1** — Fix : un sous-titre ne doit **pas** se casser en 2 blocs au milieu d'une phrase
  (ex. « le logiciel est cassé » scindé). Découpe cohérente.
- **C2** — Après génération : éditer chaque section de sous-titre dans le panneau sous-titres.
- **C3** — 🤖 Transcription la plus **précise/poussée** possible (meilleur modèle, bonne
  reconnaissance des mots).
- **C4** — 🎨 Style/édition texte des sous-titres = **même interface que l'éditeur visuel**.

## D. Texte (aligné sur l'éditeur visuel « Canva »)
- **D1** — 🎨 Sélection d'un texte → **mêmes propriétés / même interface** que l'éditeur visuel.
- **D2** — Taille du texte **figée par rapport à l'image** : indépendante du zoom de preview.
  Bug actuel : quand la preview change de taille, le texte garde sa taille absolue → incohérent.
- **D3** — Double-clic sur le texte **dans la prévisualisation** → édition inline directe
  (aujourd'hui : éditable seulement dans l'outil texte).

## E. Audio
- **E1** — Réglage du volume : pouvoir **monter au-delà de 100 %** et baisser.
- **E2** — 🔑 **Points-clés (keyframes) de volume** à des endroits précis (automation), façon CapCut.

## F. Effets visuels
- **F1** — **Transitions** : bibliothèque étoffée, du simple fondu aux transitions techniques.
- **F2** — 🎨 **Filtres / colorimétrie** : présets + réglage libre de la colorimétrie.
- **F3** — **LUTs** : import de LUTs + création de ses propres LUTs dans l'app.
- **F4** — **Stickers** : bibliothèque + import.

## G. Vitesse
- **G1** — **Curseur continu** de vitesse (remplacer les paliers fixes 0.25/0.5/1/1.5/2).

## H. Prévisualisation & manipulation d'objets
- **H1** — Enlever les **coins arrondis** de la prévisualisation (rendu non représentatif).
- **H2** — Double-clic sur un média dans la preview → **redimensionner** ; idem via les
  paramètres du média (taille).
- **H3** — 🎨 Manipulation directe des objets dans la preview comme Canva (déplacer,
  redimensionner, couleur…).
- **H4** — 🔑🎨 Zoom molette/trackpad (pinch) sur la zone de preview → zoome **uniquement le
  canvas**, pas la page web. Vaut pour le **montage ET l'éditeur visuel**.

## I. Paramètres du projet
- **I1** — Formats : garder **9:16 par défaut**, ajouter plusieurs formats de base + panneau
  paramètres complet (fonctionnalités d'un logiciel de montage moderne).
- **I2** — **Dimensions custom en pixels**.

## J. 🤖 Montage automatique (IA)
- **J1** — Auto-montage : détecter les blancs/silences → couper, garder la parole ; générer des
  sous-titres shortés **selon la charte client** ; dynamiser (transitions auto si besoin).
  Objectif : pré-mâcher le montage, la personne repasse juste dessus.

## K. Export / publication
- **K1** — Bouton **Exporter** + **programmation** de la vidéo.
- **K2** — 🎨 Flux **Publier** identique à l'éditeur visuel (publie la vidéo).

---

## Ordre de construction proposé (dépendances)
1. **B (keystone)** — refonte du modèle timeline multi-pistes + offset libre + détacher audio.
   → débloque A2, B5, B6, E, une partie de F.
2. **H1 + H4** — quick wins UX preview (coins arrondis, pinch-zoom) — indépendants.
3. **D + C4** — moteur texte partagé avec l'éditeur visuel (D1/D2/D3) puis sous-titres (C4).
4. **C1/C2/C3** — pipeline sous-titres (découpe + édition + précision).
5. **E** — audio (volume >100 % + keyframes).
6. **F + G** — transitions, filtres/LUT, stickers, curseur vitesse.
7. **I** — paramètres/formats/custom px.
8. **J** — auto-montage IA (dépend de B + C).
9. **K** — export + publication + programmation.

## En attente de Martin
- [ ] Screenshot du menu clic droit CapCut (pour B3 et les actions contextuelles).
- [ ] Priorités / ordre souhaité.
