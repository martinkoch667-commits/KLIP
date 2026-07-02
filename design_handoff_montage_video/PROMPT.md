# Prompt à donner à Claude Code

> Copie-colle le bloc ci-dessous dans Claude Code, **après avoir déposé le dossier
> `design_handoff_montage_video/` dans les sources de ton site** (par ex. à la
> racine du repo, ou dans `docs/`). Adapte le chemin à la ligne « Dossier de
> référence » si tu le places ailleurs.

---

```
# Contexte
Je veux intégrer un nouveau module de MONTAGE VIDÉO (type CapCut) dans mon app
"KLIP" (outil de création de contenu pour réseaux sociaux). J'ai un package de
design de référence déjà présent dans les sources du projet.

Dossier de référence : ./design_handoff_montage_video/
  - README.md                  → SPEC COMPLÈTE, lis-la INTÉGRALEMENT en premier
  - design_files/*.html/.css/.jsx → prototype HTML/React (référence visuelle
                                    et fonctionnelle, PAS du code à copier tel quel)

# Ta mission
Recréer ce design de façon FONCTIONNELLE dans le codebase KLIP existant, avec ses
patterns, son framework et ses librairies déjà en place. La charte visuelle
(couleurs, typo, espacements, rayons, ombres — section "Design tokens" du README)
doit être reproduite À L'IDENTIQUE. Le prototype simule les comportements ; en prod
ils doivent être réels.

# Étapes attendues (ne code pas avant l'étape 3)
1. Lis ./design_handoff_montage_video/README.md en entier, puis parcours les
   fichiers de design_files/ (surtout data.jsx, shared.jsx, panels.jsx, dir-a.jsx,
   dir-b.jsx, montage.css). Ouvre le prototype si besoin (servir design_files/ en
   statique, ouvrir "KLIP Montage vidéo.html", basculer A/B en haut à droite).
2. Explore MON codebase : framework, state management, système de composants/UI,
   où sont déjà branchés les onglets "Composer" et "Éditeur visuel", et s'il existe
   déjà un moteur de rendu/traitement vidéo ou un service IA (transcription).
3. Pose-moi tes questions, PUIS propose un plan d'intégration par étapes. Attends
   ma validation avant d'implémenter.
4. Implémente incrémentalement, une fonctionnalité livrable à la fois.

# Direction d'interface à retenir
Le proto propose 2 directions (voir §3 du README). J'utilise la Direction ___ :
  A = "Plan de travail" (timeline multi-pistes, power-user)
  B = "Séquence" (transcript éditable + ruban de scènes, guidé/éditorial)
Ignore l'autre direction. (Si je ne l'ai pas encore décidé, demande-moi.)

# Périmètre fonctionnel (détaillé en §4 du README)
- Nouvel onglet "Montage vidéo" à côté de Composer et Éditeur visuel.
- Format prioritaire : Reel 9:16 vertical.
- Import vidéos + photos (drag & drop, MP4/MOV/JPG).
- Assemblage multi-clips bout à bout : réordonner, découper/fractionner, rogner,
  dupliquer, supprimer.
- Incrustation photo = plan fixe (durée réglable, mêmes transitions/filtres),
  distinguée visuellement de la vidéo (badge).
- Sous-titres automatiques : transcription IA, texte éditable mot à mot, calage
  temporel, 4 styles animés (karaoké mot-par-mot inclus).
- Texte & titres animés, stickers, logo, barre de progression.
- Audio : musique de marque + voix off (enregistrement), niveaux, calage BPM.
- Transitions (cut/fondu/glissé/zoom/balayage/flou) + durée.
- Filtres/étalonnage (lumière, contraste, saturation) par plan.
- Vitesse par plan (0.25×–2×), ralenti lissé, lecture inversée.
- Recadrage auto du sujet (IA).
- IA discrète : montage auto (premier jet), suggestion musique, recadrage, avec
  overlay de génération.
- Lecture temps réel (play/pause, scrubber, playhead synchro) + position persistée
  en localStorage.
- Export : Reel prêt à programmer dans le calendrier KLIP.

# Exigences techniques
- State projet = source de vérité ; timeline et preview en sont des vues (voir §6
  du README pour la forme du state).
- Moteur de rendu vidéo : utilise l'existant si présent ; sinon propose une
  approche (WebCodecs / ffmpeg.wasm côté client, ou rendu serveur) et fais-la
  valider AVANT de coder.
- Transcription/IA : branche sur le service IA de KLIP.
- Reprends EXACTEMENT les design tokens du README (charte forêt/menthe/acide,
  Archivo + Instrument Serif + Satoshi + Cabinet Grotesk, rayons, ombres,
  easing cubic-bezier(.2,.7,.3,1)). N'invente aucune valeur.
- Accessibilité : cibles tactiles ≥ 44px, contrastes AA, respect de
  prefers-reduced-motion.
```

---

### Rappel avant de lancer
- Dépose bien `design_handoff_montage_video/` dans le repo **avant** d'envoyer le prompt.
- Remplace `___` par **A** ou **B** (ou laisse Claude Code te poser la question).
- Si tu ranges le dossier ailleurs, corrige le chemin « Dossier de référence ».
