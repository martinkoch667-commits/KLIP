# Roadmap Charte / Génération de texte / Templates (éditeur visuel + montage)

> Brief de Martin (session 2026-07-16). Complémentaire de MONTAGE_ROADMAP.md.
> Fichiers clés : `lib/generate-description.ts` (prompt + fetch charte), `app/api/generate-description`,
> `app/api/instagram/analyze-style` (analyse style IG), `supabase/add-brand-charter.sql` /
> `add-brand-voice.sql` (champs charte du workspace), montage `SubTemplate` (constants.ts, localStorage).

## Constat de départ
- La génération **récupère déjà** la charte du workspace : `name, sector, tone, words_to_use,
  words_to_avoid, company_description, caption_examples, brand_voice_prompt, description_style`
  → donc les params de compte sont branchés. Le problème = **qualité du prompt** + features manquantes.

## A. 🎨 Propositions de templates de texte depuis la charte
- Une fois la charte intégrée (ou à la création d'un template), **proposer des templates de texte**
  pour les visuels, **adaptés à la charte** (typo, couleurs, ton).
- Stratégie : soit **piocher** dans les templates existants et les adapter à la charte, soit **créer
  du neuf** en fonction de la charte. (Réutilise la « force créative » déjà démontrée sur les templates.)

## B. ✏️ Génération de texte plus humaine (PRIORITÉ, faisable sans test)
- **Moins générique, plus humain** : mots simples/naturels, phrases courtes, ton oral, zéro jargon
  marketing / superlatif vide. On doit sentir une vraie personne.
- **Plus court par défaut** ; **coller à la longueur/au style des exemples réels du client**.
- **Utiliser à fond tous les params de compte** (charte orale) ; **ne jamais redemander le style**
  s'il est déjà connu. → vérifier aussi l'UI de l'éditeur (champ style redondant à retirer ?).
- ✅ Étape 1 faite : refonte du prompt système (`lib/generate-description.ts`).

## C. 🎬 Description vidéo APRÈS le montage
- Pour une vidéo, générer la description **une fois la vidéo montée** (pour l'analyser).
- Vérifier / améliorer la **lecture des vidéos** : aujourd'hui `generate-description` prend une seule
  image (photoUrl). Pour la vidéo → échantillonner plusieurs frames du montage et les envoyer.
- Brancher un bouton « Générer la description » côté montage (après export), qui capture des frames
  et appelle la génération avec la charte.

## D. 🎨 Template de sous-titres animés depuis la charte → montage
- Dans la création de charte : proposer une **base de sous-titres animés** dérivée de la **typo + couleurs**
  de la charte (mappe vers un `SubStyle` / `SubCustom`).
- L'utilisateur peut la retoucher ; le template est **persisté au niveau workspace** (pas juste localStorage).
- Le **montage l'applique par défaut** → plus besoin de refaire les sous-titres à chaque fois.
- Part d'un template existant adapté, ou d'un template créé exprès pour le client.

## Ordre proposé
1. **B** (prompt) — fait / à affiner. Puis retirer le champ « style » redondant dans l'éditeur si présent.
2. **D** (sous-titres charte → montage) — cohérent avec le travail montage récent.
3. **A** (propositions de templates de texte).
4. **C** (description vidéo post-montage + lecture multi-frames).

## En attente de Martin
- [ ] Retour de test sur le montage (24 commits).
- [ ] Où se fait exactement le « il me redemande le style » (quelle étape de l'éditeur) — pour retirer le doublon.
